const repository = require('./transitionRepairWorkflowRepository');
const { mapRepairJob } = require('../../mappers/repairMapper');
const {
  REPAIR_WORKFLOW_STATUS,
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

function requireText(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new RepairWorkflowCommandError(
      'INVALID_REPAIR_WORKFLOW_COMMAND',
      `${field} is required`,
      { field }
    );
  }
  return normalized;
}

function currentWorkflowStatus(repairJob) {
  const latest = repairJob.device?.passportEvents?.[0];
  return latest?.metadata?.workflowTargetStatus || REPAIR_WORKFLOW_STATUS.RECEIVED;
}

class TransitionRepairWorkflowService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  execute(actor, command) {
    const repairJobId = requirePositiveInteger(command?.repairJobId, 'repairJobId');
    const branchId = requirePositiveInteger(actor?.branchId, 'actor.branchId');
    const employeeId = requirePositiveInteger(actor?.employeeId, 'actor.employeeId');
    const action = requireText(command?.action, 'action');
    const commandKey = requireText(command?.commandKey, 'commandKey');
    const expectedWorkflowStatus = command?.expectedWorkflowStatus
      ? requireText(command.expectedWorkflowStatus, 'expectedWorkflowStatus')
      : null;

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

      const updated = await repo.updateLegacyStatus(repairJobId, legacyStatus);
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
        description: command.note || null,
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
        repairJob: mapRepairJob(updated),
      };
    });
  }
}

module.exports = new TransitionRepairWorkflowService();
module.exports.RepairWorkflowCommandError = RepairWorkflowCommandError;
module.exports.TransitionRepairWorkflowService = TransitionRepairWorkflowService;
module.exports.currentWorkflowStatus = currentWorkflowStatus;
