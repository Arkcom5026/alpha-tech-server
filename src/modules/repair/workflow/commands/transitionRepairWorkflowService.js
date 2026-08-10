const repository = require('./transitionRepairWorkflowRepository');
const { mapRepairJob } = require('../../mappers/repairMapper');
const {
  evaluateIntakeCompletion,
} = require('../../intake-evidence/intakeEvidencePolicy');
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
      'diagnosis text is too long',
      { maxLength }
    );
  }
  return normalized || null;
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
    recommendedAction: requireText(
      diagnosis.recommendedAction,
      'diagnosis.recommendedAction'
    ),
    estimatedCost,
    customerNote: optionalText(diagnosis.customerNote),
  };
}

function currentWorkflowStatus(repairJob) {
  const latest = repairJob.device?.passportEvents?.[0];
  return latest?.metadata?.workflowTargetStatus || REPAIR_WORKFLOW_STATUS.RECEIVED;
}

function assertIntakeCompleteForDiagnosis(repairJob, action) {
  if (action !== REPAIR_WORKFLOW_ACTION.QUEUE_DIAGNOSIS) return;

  const completion = evaluateIntakeCompletion(repairJob.deviceIntake);
  if (!completion.complete) {
    throw new RepairWorkflowCommandError(
      'REPAIR_INTAKE_INCOMPLETE',
      'Repair intake evidence must be complete before diagnosis can be queued',
      {
        repairJobId: repairJob.id,
        completion,
      }
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

    return this.repository.transaction(async (repo) => {
      const repairJob = await repo.findRepairJob(repairJobId);
      if (!repairJob || repairJob.branchId !== branchId) {
        throw new RepairWorkflowCommandError(
          'REPAIR_JOB_NOT_FOUND',
          'Repair job was not found in the actor branch',
          { repairJobId, branchId }
        );
      }
      if (!repairJob.deviceId || !repairJob.device) {
        throw new RepairWorkflowCommandError(
          'REPAIR_DEVICE_REQUIRED',
          'Repair workflow commands require a linked device passport',
          { repairJobId }
        );
      }

      const workflowStatus = currentWorkflowStatus(repairJob);
      if (expectedWorkflowStatus && expectedWorkflowStatus !== workflowStatus) {
        throw new RepairWorkflowCommandError(
          'REPAIR_WORKFLOW_VERSION_CONFLICT',
          'Repair workflow status changed before this command was applied',
          {
            repairJobId,
            expectedWorkflowStatus,
            actualWorkflowStatus: workflowStatus,
          }
        );
      }

      assertIntakeCompleteForDiagnosis(repairJob, action);

      const transition = resolveRepairWorkflowTransition(workflowStatus, action);
      const legacyStatus = projectLegacyServiceStatus(transition.targetStatus);
      const occurredAt = command.occurredAt ? new Date(command.occurredAt) : new Date();
      if (Number.isNaN(occurredAt.getTime())) {
        throw new RepairWorkflowCommandError(
          'INVALID_REPAIR_WORKFLOW_COMMAND',
          'occurredAt must be a valid date',
          { field: 'occurredAt' }
        );
      }

      const repairUpdate = diagnosis
        ? {
            estimatedCost: diagnosis.estimatedCost,
            technicianNotes: [
              `ผลตรวจ: ${diagnosis.findings}`,
              diagnosis.cause ? `สาเหตุ: ${diagnosis.cause}` : null,
              `แนวทาง: ${diagnosis.recommendedAction}`,
              diagnosis.customerNote ? `หมายเหตุลูกค้า: ${diagnosis.customerNote}` : null,
            ]
              .filter(Boolean)
              .join('\n'),
          }
        : {};

      const updated = await repo.updateLegacyStatus(repairJobId, legacyStatus, repairUpdate);
      const event = await repo.publishPassportEvent({
        deviceId: repairJob.deviceId,
        branchId,
        eventType: transition.passportEventType,
        sourceType: 'REPAIR_JOB',
        sourceId: String(repairJobId),
        eventKey: `repair-workflow:${repairJobId}:${commandKey}`,
        correlationId: command.correlationId || `repair-job:${repairJobId}`,
        causationId: command.causationId || commandKey,
        title: `งานซ่อม ${repairJob.jobNo}: ${transition.action}`,
        description: command.note || diagnosis?.customerNote || null,
        actorEmployeeId: employeeId,
        customerVisible: command.customerVisible !== false,
        metadata: {
          repairJobId,
          commandKey,
          action: transition.action,
          workflowPreviousStatus: transition.previousStatus,
          workflowTargetStatus: transition.targetStatus,
          legacyServiceStatus: legacyStatus,
          terminal: transition.terminal,
          note: command.note || null,
          diagnosis,
        },
        occurredAt,
      });

      return {
        repairJobId,
        commandKey,
        previousStatus: transition.previousStatus,
        status: transition.targetStatus,
        legacyStatus,
        terminal: transition.terminal,
        passportEventId: event.id,
        availableActions: getAvailableRepairWorkflowActions(transition.targetStatus),
        diagnosis,
        repairJob: mapRepairJob(updated),
      };
    });
  }
}

module.exports = new TransitionRepairWorkflowService();
module.exports.RepairWorkflowCommandError = RepairWorkflowCommandError;
module.exports.TransitionRepairWorkflowService = TransitionRepairWorkflowService;
module.exports.currentWorkflowStatus = currentWorkflowStatus;
module.exports.assertIntakeCompleteForDiagnosis = assertIntakeCompleteForDiagnosis;
module.exports.normalizeDiagnosis = normalizeDiagnosis;
