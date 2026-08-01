const ALLOWED_EXECUTION_ROLES = new Set(['ADMIN', 'SUPERADMIN']);

const createExecutionAccessError = (code, message, details = undefined) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 403;
  if (details) error.details = details;
  return error;
};

const isExecutionEnabled = (env = process.env) => (
  String(env.ALLOW_MISSING_COST_RECOVERY_EXECUTION || '').trim().toLowerCase() === 'true'
);

const assertMissingCostRecoveryExecutionAccess = ({ user, env = process.env }) => {
  if (!isExecutionEnabled(env)) {
    throw createExecutionAccessError(
      'MISSING_COST_RECOVERY_EXECUTION_DISABLED',
      'Missing cost recovery execution is not enabled for this runtime'
    );
  }

  const employeeId = Number(user?.employeeId || user?.profileId);
  const branchId = Number(user?.branchId);
  const role = String(user?.role || '').trim().toUpperCase();
  const profileType = String(user?.profileType || '').trim().toLowerCase();

  if (profileType !== 'employee' || !Number.isInteger(employeeId) || employeeId <= 0) {
    throw createExecutionAccessError(
      'MISSING_COST_RECOVERY_EMPLOYEE_AUTHORITY_REQUIRED',
      'An authenticated employee identity is required for missing cost recovery execution'
    );
  }

  if (!Number.isInteger(branchId) || branchId <= 0) {
    throw createExecutionAccessError(
      'MISSING_COST_RECOVERY_BRANCH_AUTHORITY_REQUIRED',
      'An authenticated branch authority is required for missing cost recovery execution'
    );
  }

  if (!ALLOWED_EXECUTION_ROLES.has(role)) {
    throw createExecutionAccessError(
      'MISSING_COST_RECOVERY_EXECUTION_ROLE_FORBIDDEN',
      'The authenticated role is not allowed to execute missing cost recovery',
      { role }
    );
  }

  return Object.freeze({
    employeeId,
    branchId,
    role,
    environment: String(env.NODE_ENV || 'unknown').trim().toLowerCase() || 'unknown',
    operationalFlag: 'ALLOW_MISSING_COST_RECOVERY_EXECUTION',
  });
};

module.exports = {
  ALLOWED_EXECUTION_ROLES,
  createExecutionAccessError,
  isExecutionEnabled,
  assertMissingCostRecoveryExecutionAccess,
};
