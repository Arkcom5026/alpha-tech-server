const repository = require('./transitionRepairWorkflowRepository');
const { mapRepairJob } = require('../../mappers/repairMapper');
const {
  evaluateIntakeCompletion,
} = require('../../intake-evidence/intakeEvidencePolicy');
const {
  assertRepairNotHeldByActiveClaim,
} = require('../../policies/claimRepairHoldPolicy');
const {
  assertRepairNotHeldByActiveSubcontract,
} = require('../../policies/subcontractRepairHoldPolicy');
const {
  REPAIR_WORKFLOW_STATUS,
  REPAIR_WORKFLOW_ACTION,
  getAvailableRepairWorkflowActions,
  projectLegacyServiceStatus,
  resolveRepairWorkflowTransition,
} = require('../policies/repairWorkflowPolicy');

class RepairWorkflowCommandError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RepairWorkflowCommandError';
    this.code = code;
    this.details = details;
  }
}

function requirePositiveInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RepairWorkflowCommandError(
      'INVALID_REPAIR_WORKFLOW_COMMAND',
      `${field} must be a positive integer`,
      { field }
    );
  }
  return parsed;
}

function requireText(value, field, maxLength = 4000) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new RepairWorkflowCommandError(
      'INVALID_REPAIR_WORKFLOW_COMMAND',
      `${field} is required`,
      { field }
    );
  }
  if (normalized.length > maxLength) {
    throw new RepairWorkflowCommandError(
      'INVALID_REPAIR_WORKFLOW_COMMAND',
      `${field} is too long`,
      { field, maxLength }
    );
  }
  return normalized;
}

function optionalText(value, maxLength = 4000) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim();
  if (normalized.length > maxLength) {
    throw new RepairWorkflowCommandError(
      'INVALID_REPAIR_WORKFLOW_COMMAND',
      'workflow text is too long',
      { maxLength }
    );
  }
  return normalized || null;
}

function requireNonNegativeMoney(value, field) {
  if (value === undefined || value === null || value === '') {
    throw new RepairWorkflowCommandError(
      'INVALID_REPAIR_WORKFLOW_COMMAND',
      `${field} is required`,
      { field }
    );
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new RepairWorkflowCommandError(
      'INVALID_REPAIR_WORKFLOW_COMMAND',
      `${field} must be a non-negative number`,
      { field }
    );
  }
  return parsed;
}

function normalizeDiagnosis(action, rawDiagnosis) {
  if (action !== REPAIR_WORKFLOW_ACTION.COMPLETE_DIAGNOSIS) return null;
  const diagnosis = rawDiagnosis && typeof rawDiagnosis === 'object' ? rawDiagnosis : {};
  const estimatedCost = Number(diagnosis.estimatedCost ?? 0);
  if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
    throw new RepairWorkflowCommandError(
      'INVALID_REPAIR_WORKFLOW_COMMAND',
      'diagnosis.estimatedCost must be a non-negative number',
      { field: 'diagnosis.estimatedCost' }
    );
  }

  return {
    findings: requireText(diagnosis.findings, 'diagnosis.findings'),
    cause: optionalText(diagnosis.cause),
    recommendedAction: requireText(diagnosis.recommendedAction, 'diagnosis.recommendedAction'),
    estimatedCost,
    customerNote: optionalText(diagnosis.customerNote),
  };
}

function normalizeRepairCompletion(action, rawCompletion) {
  if (![REPAIR_WORKFLOW_ACTION.COMPLETE_REPAIR_DIRECT, REPAIR_WORKFLOW_ACTION.COMPLETE_REPAIR].includes(action)) return null;
  const completion = rawCompletion && typeof rawCompletion === 'object' ? rawCompletion : {};
  return {
    workPerformed: requireText(completion.workPerformed, 'repairCompletion.workPerformed'),
    resultSummary: requireText(completion.resultSummary, 'repairCompletion.resultSummary'),
    finalAmount: requireNonNegativeMoney(completion.finalAmount, 'repairCompletion.finalAmount'),
    technicianNote: optionalText(completion.technicianNote),
  };
}

function normalizeQc(action, rawQc) {
  if (![REPAIR_WORKFLOW_ACTION.PASS_QC, REPAIR_WORKFLOW_ACTION.FAIL_QC].includes(action)) return null;
  const qc = rawQc && typeof rawQc === 'object' ? rawQc : {};
  const checks = Array.isArray(qc.checks)
    ? qc.checks.map((item) => ({
        key: requireText(item?.key, 'qc.checks.key', 120),
        label: requireText(item?.label, 'qc.checks.label', 255),
        passed: item?.passed === true,
      }))
    : [];
  if (!checks.length) {
    throw new RepairWorkflowCommandError(
      'INVALID_REPAIR_WORKFLOW_COMMAND',
      'qc.checks is required',
      { field: 'qc.checks' }
    );
  }
  if (action === REPAIR_WORKFLOW_ACTION.PASS_QC && checks.some((item) => !item.passed)) {
    throw new RepairWorkflowCommandError(
      'INVALID_REPAIR_WORKFLOW_COMMAND',
      'all qc checks must pass before PASS_QC',
      { field: 'qc.checks' }
    );
  }
  return {
    checks,
    note: optionalText(qc.note),
  };
}

function normalizeExceptionalNote(action, note) {
  if (action === REPAIR_WORKFLOW_ACTION.CANCEL) {
    return requireText(note, 'note', 2000);
  }
  if (action === REPAIR_WORKFLOW_ACTION.REOPEN_AFTER_REJECTION) {
    return requireText(note, 'note', 2000);
  }
  return optionalText(note, 2000);
}

function currentWorkflowStatus(repairJob) {
  const repairOwned = repairJob.repairWorkflowEvent;
  if (repairOwned?.targetStatus) return repairOwned.targetStatus;
  if (repairOwned?.metadata?.workflowTargetStatus) {
    return repairOwned.metadata.workflowTargetStatus;
  }

  const legacyPassport = repairJob.device?.passportEvents?.[0];
  return legacyPassport?.metadata?.workflowTargetStatus || REPAIR_WORKFLOW_STATUS.RECEIVED;
}

function assertIntakeCompleteForEntry(repairJob, action, workflowStatus = currentWorkflowStatus(repairJob)) {
  const requiresCompletedIntake = [
    REPAIR_WORKFLOW_ACTION.ACCEPT_JOB,
    REPAIR_WORKFLOW_ACTION.QUEUE_DIAGNOSIS,
    REPAIR_WORKFLOW_ACTION.START_PRE_AGREED_SERVICE,
  ].includes(action) || (
    action === REPAIR_WORKFLOW_ACTION.START_REPAIR &&
    [REPAIR_WORKFLOW_STATUS.RECEIVED, REPAIR_WORKFLOW_STATUS.ACCEPTED].includes(workflowStatus)
  );

  if (!requiresCompletedIntake) return;

  // Business-neutral repair jobs may intentionally have no Device Passport/DeviceIntake.
  // Their core intake authority is the RepairJob itself (customer + item description + symptoms).
  if (!repairJob.deviceId && !repairJob.deviceIntake) return;

  const completion = evaluateIntakeCompletion(repairJob.deviceIntake);
  if (!completion.complete) {
    throw new RepairWorkflowCommandError(
      'REPAIR_INTAKE_INCOMPLETE',
      'Repair intake evidence must be complete before the technician can accept, inspect, or start work',
      { repairJobId: repairJob.id, completion }
    );
  }
}

function assertPreAgreedServiceAuthority(repairJob, action) {
  if (action !== REPAIR_WORKFLOW_ACTION.START_PRE_AGREED_SERVICE) return;
  const agreement = repairJob.preAgreedService;
  if (!agreement?.enabled || !agreement.confirmedByName) {
    throw new RepairWorkflowCommandError(
      'PRE_AGREED_SERVICE_REQUIRED',
      'Repair authorization evidence is required before the authorized fast path can start',
      { repairJobId: repairJob.id }
    );
  }
}

class TransitionRepairWorkflowService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  execute(actor, command) {
    const repairJobId = requirePositiveInteger(command?.repairJobId, 'repairJobId');
    const branchId = requirePositiveInteger(actor?.branchId, 'actor.branchId');
    const employeeId = requirePositiveInteger(actor?.employeeId, 'actor.employeeId');
    const action = requireText(command?.action, 'action', 80);
    const commandKey = requireText(command?.commandKey, 'commandKey', 160);
    const expectedWorkflowStatus = command?.expectedWorkflowStatus
      ? requireText(command.expectedWorkflowStatus, 'expectedWorkflowStatus', 80)
      : null;
    const diagnosis = normalizeDiagnosis(action, command?.diagnosis);
    const repairCompletion = normalizeRepairCompletion(action, command?.repairCompletion);
    const qc = normalizeQc(action, command?.qc);
    const note = normalizeExceptionalNote(action, command?.note);

    return this.repository.transaction(async (repo) => {
      const repairJob = await repo.findRepairJob(repairJobId);
      if (!repairJob || repairJob.branchId !== branchId) {
        throw new RepairWorkflowCommandError('REPAIR_JOB_NOT_FOUND', 'Repair job was not found in the actor branch', { repairJobId, branchId });
      }

      assertRepairNotHeldByActiveClaim(repairJob, RepairWorkflowCommandError);
      const activeSubcontract = typeof repo.findActiveSubcontract === 'function'
        ? await repo.findActiveSubcontract(repairJobId)
        : null;
      assertRepairNotHeldByActiveSubcontract(
        activeSubcontract,
        RepairWorkflowCommandError
      );

      const workflowStatus = currentWorkflowStatus(repairJob);
      if (expectedWorkflowStatus && expectedWorkflowStatus !== workflowStatus) {
        throw new RepairWorkflowCommandError('REPAIR_WORKFLOW_VERSION_CONFLICT', 'Repair workflow status changed before this command was applied', {
          repairJobId,
          expectedWorkflowStatus,
          actualWorkflowStatus: workflowStatus,
        });
      }

      assertIntakeCompleteForEntry(repairJob, action, workflowStatus);
      assertPreAgreedServiceAuthority(repairJob, action);
      const transition = resolveRepairWorkflowTransition(workflowStatus, action);
      const legacyStatus = projectLegacyServiceStatus(transition.targetStatus);
      const occurredAt = command.occurredAt ? new Date(command.occurredAt) : new Date();
      if (Number.isNaN(occurredAt.getTime())) {
        throw new RepairWorkflowCommandError('INVALID_REPAIR_WORKFLOW_COMMAND', 'occurredAt must be a valid date', { field: 'occurredAt' });
      }

      const repairUpdate = action === REPAIR_WORKFLOW_ACTION.ACCEPT_JOB
        ? { technicianId: employeeId }
        : diagnosis
          ? {
              estimatedCost: diagnosis.estimatedCost,
              technicianNotes: [
                `ผลตรวจ: ${diagnosis.findings}`,
                diagnosis.cause ? `สาเหตุ: ${diagnosis.cause}` : null,
                `แนวทาง: ${diagnosis.recommendedAction}`,
                diagnosis.customerNote ? `หมายเหตุลูกค้า: ${diagnosis.customerNote}` : null,
              ].filter(Boolean).join('\n'),
            }
          : repairCompletion
            ? {
                estimatedCost: repairCompletion.finalAmount,
                technicianNotes: [
                  repairJob.technicianNotes || null,
                  `งานที่ดำเนินการ: ${repairCompletion.workPerformed}`,
                  `ผลหลังซ่อม: ${repairCompletion.resultSummary}`,
                  `ค่าซ่อมจริง: ${repairCompletion.finalAmount}`,
                  repairCompletion.technicianNote ? `หมายเหตุช่าง: ${repairCompletion.technicianNote}` : null,
                ].filter(Boolean).join('\n'),
              }
            : [REPAIR_WORKFLOW_ACTION.CANCEL, REPAIR_WORKFLOW_ACTION.REOPEN_AFTER_REJECTION].includes(action)
              ? {
                  technicianNotes: [
                    repairJob.technicianNotes || null,
                    action === REPAIR_WORKFLOW_ACTION.CANCEL
                      ? `ยกเลิกงาน: ${note}`
                      : `เปิดตรวจสอบใหม่หลังลูกค้าไม่อนุมัติ: ${note}`,
                  ].filter(Boolean).join('\n'),
                }
              : {};

      const updated = await repo.updateLegacyStatus(repairJobId, legacyStatus, repairUpdate);
      const description =
        note ||
        (action === REPAIR_WORKFLOW_ACTION.ACCEPT_JOB
          ? 'ช่างรับผิดชอบใบงานแล้ว'
          : null) ||
        (action === REPAIR_WORKFLOW_ACTION.START_PRE_AGREED_SERVICE
          ? repairJob.preAgreedService?.agreedScope
          : null) ||
        diagnosis?.customerNote ||
        repairCompletion?.resultSummary ||
        qc?.note ||
        null;
      const metadata = {
        repairJobId,
        commandKey,
        action: transition.action,
        workflowPreviousStatus: transition.previousStatus,
        workflowTargetStatus: transition.targetStatus,
        legacyServiceStatus: legacyStatus,
        terminal: transition.terminal,
        note,
        acceptedByEmployeeId:
          action === REPAIR_WORKFLOW_ACTION.ACCEPT_JOB ? employeeId : null,
        preAgreedService:
          action === REPAIR_WORKFLOW_ACTION.START_PRE_AGREED_SERVICE
            ? repairJob.preAgreedService
            : null,
        diagnosis,
        repairCompletion,
        qc,
      };
      const eventKey = `repair-workflow:${repairJobId}:${commandKey}`;
      const correlationId = command.correlationId || `repair-job:${repairJobId}`;
      const causationId = command.causationId || commandKey;
      const title = `งานซ่อม ${repairJob.jobNo}: ${transition.action}`;

      const workflowEvent = await repo.publishWorkflowEvent({
        repairJobId,
        branchId,
        eventType: transition.passportEventType,
        action: transition.action,
        previousStatus: transition.previousStatus,
        targetStatus: transition.targetStatus,
        eventKey,
        correlationId,
        causationId,
        title,
        description,
        actorEmployeeId: employeeId,
        customerVisible: command.customerVisible !== false,
        metadata,
        occurredAt,
      });

      let passportEvent = null;
      if (repairJob.deviceId && repairJob.device && typeof repo.publishPassportEvent === 'function') {
        passportEvent = await repo.publishPassportEvent({
          deviceId: repairJob.deviceId,
          branchId,
          eventType: transition.passportEventType,
          sourceType: 'REPAIR_JOB',
          sourceId: String(repairJobId),
          eventKey,
          correlationId,
          causationId,
          title,
          description,
          actorEmployeeId: employeeId,
          customerVisible: command.customerVisible !== false,
          metadata,
          occurredAt,
        });
      }

      return {
        repairJobId,
        commandKey,
        previousStatus: transition.previousStatus,
        status: transition.targetStatus,
        legacyStatus,
        terminal: transition.terminal,
        workflowEventId: workflowEvent.id,
        passportEventId: passportEvent?.id || null,
        availableActions: getAvailableRepairWorkflowActions(transition.targetStatus),
        acceptedByEmployeeId:
          action === REPAIR_WORKFLOW_ACTION.ACCEPT_JOB ? employeeId : null,
        preAgreedService:
          action === REPAIR_WORKFLOW_ACTION.START_PRE_AGREED_SERVICE
            ? repairJob.preAgreedService
            : null,
        diagnosis,
        repairCompletion,
        qc,
        repairJob: mapRepairJob(updated),
      };
    });
  }
}

module.exports = new TransitionRepairWorkflowService();
module.exports.RepairWorkflowCommandError = RepairWorkflowCommandError;
module.exports.TransitionRepairWorkflowService = TransitionRepairWorkflowService;
module.exports.currentWorkflowStatus = currentWorkflowStatus;
module.exports.assertIntakeCompleteForEntry = assertIntakeCompleteForEntry;
module.exports.assertIntakeCompleteForDiagnosis = assertIntakeCompleteForEntry;
module.exports.assertPreAgreedServiceAuthority = assertPreAgreedServiceAuthority;
module.exports.normalizeDiagnosis = normalizeDiagnosis;
module.exports.normalizeRepairCompletion = normalizeRepairCompletion;
module.exports.normalizeQc = normalizeQc;
module.exports.normalizeExceptionalNote = normalizeExceptionalNote;
