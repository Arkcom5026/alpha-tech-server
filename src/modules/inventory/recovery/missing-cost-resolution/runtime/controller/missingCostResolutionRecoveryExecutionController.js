const service = require('../../recovery-execution/service/missingCostResolutionRecoveryExecutionService');
const {
  buildOperatorIdentity,
} = require('./missingCostResolutionRecoveryPreviewController');

const requireTestDatabaseAuthority = () => {
  const databaseUrl = String(process.env.DATABASE_URL || '').toLowerCase();
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
  const explicitlyAllowed = String(process.env.ALLOW_MISSING_COST_RECOVERY_EXECUTION || '').toLowerCase() === 'true';

  const testAuthority = explicitlyAllowed && (
    nodeEnv === 'test'
    || databaseUrl.includes('test')
    || databaseUrl.includes('shadow')
  );

  if (!testAuthority) {
    const error = new Error('Missing cost recovery execution is restricted to Test DB authority');
    error.code = 'MISSING_COST_RECOVERY_TEST_DB_AUTHORITY_REQUIRED';
    error.statusCode = 403;
    throw error;
  }
};

const executeRecovery = async (req, res, next) => {
  try {
    requireTestDatabaseAuthority();

    const operatorIdentity = buildOperatorIdentity(req.user);
    const executorIdentity = operatorIdentity;
    const idempotencyKey = String(req.get('X-Idempotency-Key') || '').trim();

    const result = await service.execute({
      branchId: req.user?.branchId,
      resolutionId: req.params.resolutionId,
      operatorIdentity,
      executorIdentity,
      approval: {
        ...(req.body || {}),
        idempotencyKey,
      },
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  executeRecovery,
  requireTestDatabaseAuthority,
};
