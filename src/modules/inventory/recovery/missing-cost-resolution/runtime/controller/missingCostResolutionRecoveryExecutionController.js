const service = require('../../recovery-execution/service/missingCostResolutionRecoveryExecutionService');
const {
  buildOperatorIdentity,
} = require('./missingCostResolutionRecoveryPreviewController');
const {
  assertMissingCostRecoveryExecutionAccess,
} = require('../policy/missingCostResolutionExecutionAccessPolicy');

const executeRecovery = async (req, res, next) => {
  try {
    const accessAuthority = assertMissingCostRecoveryExecutionAccess({ user: req.user });
    const operatorIdentity = buildOperatorIdentity(req.user);
    const executorIdentity = operatorIdentity;
    const idempotencyKey = String(req.get('X-Idempotency-Key') || '').trim();

    const result = await service.execute({
      branchId: accessAuthority.branchId,
      resolutionId: req.params.resolutionId,
      operatorIdentity,
      executorIdentity,
      approval: {
        ...(req.body || {}),
        idempotencyKey,
      },
    });

    return res.status(200).json({
      ...result,
      executionAccess: {
        role: accessAuthority.role,
        environment: accessAuthority.environment,
        operationalFlag: accessAuthority.operationalFlag,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  executeRecovery,
  assertMissingCostRecoveryExecutionAccess,
};
