const previewService = require('../../recovery-preview/service/missingCostResolutionRecoveryPreviewService');
const {
  buildMissingCostResolutionRecoveryApprovalPlan,
} = require('../../recovery-plan/buildMissingCostResolutionRecoveryApprovalPlan');
const {
  buildMissingCostResolutionRecoveryExecutionAuthority,
} = require('../buildMissingCostResolutionRecoveryExecutionAuthority');
const executionRepository = require('../repository/missingCostResolutionRecoveryExecutionRepository');

const requireText = (value, field) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    const error = new Error(`${field} is required`);
    error.code = 'MISSING_COST_RECOVERY_EXECUTION_INPUT_REQUIRED';
    error.statusCode = 400;
    error.details = { field };
    throw error;
  }
  return normalized;
};

class MissingCostResolutionRecoveryExecutionService {
  constructor({
    recoveryPreviewService = previewService,
    repository = executionRepository,
  } = {}) {
    this.previewService = recoveryPreviewService;
    this.repository = repository;
  }

  async execute({
    branchId,
    resolutionId,
    operatorIdentity,
    executorIdentity,
    approval,
  }) {
    const operator = requireText(operatorIdentity, 'operatorIdentity');
    const executor = requireText(executorIdentity, 'executorIdentity');

    const preview = await this.previewService.buildPreview({
      branchId,
      resolutionId,
      operatorIdentity: operator,
    });

    const plan = buildMissingCostResolutionRecoveryApprovalPlan({
      preview,
      operatorIdentity: operator,
    });

    const executionAuthority = buildMissingCostResolutionRecoveryExecutionAuthority({
      plan,
      approval,
      executorIdentity: executor,
    });

    return this.repository.execute({
      executionAuthority,
      plan,
      preview,
    });
  }
}

module.exports = new MissingCostResolutionRecoveryExecutionService();
module.exports.MissingCostResolutionRecoveryExecutionService = MissingCostResolutionRecoveryExecutionService;
module.exports.requireText = requireText;
