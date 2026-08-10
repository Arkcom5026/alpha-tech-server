const transitionRepairWorkflowService = require('../commands/transitionRepairWorkflowService');
const { resolveRepairActor } = require('../../utils/repairActor');

const REPAIR_WORKFLOW_RESPONSE_VERSION = 1;

const HTTP_STATUS_BY_CODE = Object.freeze({
  INVALID_REPAIR_WORKFLOW_COMMAND: 400,
  INVALID_REPAIR_WORKFLOW_STATUS: 400,
  INVALID_REPAIR_WORKFLOW_ACTION: 400,
  REPAIR_WORKFLOW_TRANSITION_NOT_ALLOWED: 409,
  REPAIR_WORKFLOW_VERSION_CONFLICT: 409,
  REPAIR_INTAKE_INCOMPLETE: 409,
  REPAIR_DEVICE_REQUIRED: 409,
  REPAIR_JOB_NOT_FOUND: 404,
});

function normalizeWorkflowCommand(req) {
  return {
    repairJobId: req.params.id,
    action: req.body?.action,
    commandKey: req.body?.commandKey,
    expectedWorkflowStatus: req.body?.expectedWorkflowStatus,
    correlationId: req.body?.correlationId,
    causationId: req.body?.causationId,
    note: req.body?.note,
    diagnosis: req.body?.diagnosis,
    repairCompletion: req.body?.repairCompletion,
    qc: req.body?.qc,
    customerVisible: req.body?.customerVisible,
    occurredAt: req.body?.occurredAt,
  };
}

function projectRepairWorkflowCommandResponse(result) {
  return {
    responseVersion: REPAIR_WORKFLOW_RESPONSE_VERSION,
    repairJobId: result.repairJobId,
    commandKey: result.commandKey,
    previousStatus: result.previousStatus,
    status: result.status,
    legacyStatus: result.legacyStatus,
    terminal: result.terminal,
    passportEventId: result.passportEventId,
    availableActions: result.availableActions,
    diagnosis: result.diagnosis || null,
    repairCompletion: result.repairCompletion || null,
    qc: result.qc || null,
    repairJob: result.repairJob,
  };
}

function mapRepairWorkflowHttpError(error) {
  if (!error?.statusCode && HTTP_STATUS_BY_CODE[error?.code]) {
    error.statusCode = HTTP_STATUS_BY_CODE[error.code];
  }
  return error;
}

function createTransitionRepairWorkflowController(service = transitionRepairWorkflowService) {
  return async function transitionRepairWorkflow(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const result = await service.execute(actor, normalizeWorkflowCommand(req));

      return res.status(200).json({
        success: true,
        message: 'อัปเดตขั้นตอนงานซ่อมเรียบร้อยแล้ว',
        data: projectRepairWorkflowCommandResponse(result),
      });
    } catch (error) {
      return next(mapRepairWorkflowHttpError(error));
    }
  };
}

module.exports = {
  HTTP_STATUS_BY_CODE,
  REPAIR_WORKFLOW_RESPONSE_VERSION,
  createTransitionRepairWorkflowController,
  mapRepairWorkflowHttpError,
  normalizeWorkflowCommand,
  projectRepairWorkflowCommandResponse,
  transitionRepairWorkflow: createTransitionRepairWorkflowController(),
};