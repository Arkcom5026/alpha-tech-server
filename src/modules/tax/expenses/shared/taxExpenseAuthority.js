'use strict';

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const positiveInteger = (value) => {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
};

const resolveTaxExpenseAuthority = ({ user, requestedBranchId }) => {
  if (user?.profileType !== 'employee' || !positiveInteger(user?.employeeId)) {
    fail('TAX_EXPENSE_EMPLOYEE_REQUIRED', 'Tax expense access requires an active employee profile', 403);
  }

  const actorBranchId = positiveInteger(user?.branchId);
  const requested = requestedBranchId === undefined || requestedBranchId === null || requestedBranchId === ''
    ? null
    : positiveInteger(requestedBranchId);

  if (requestedBranchId !== undefined && requestedBranchId !== null && requestedBranchId !== '' && !requested) {
    fail('TAX_EXPENSE_BRANCH_INVALID', 'branchId must be a positive integer');
  }

  if (!actorBranchId) {
    fail('TAX_EXPENSE_BRANCH_REQUIRED', 'Employee branch authority is required', 403);
  }

  if (requested && requested !== actorBranchId) {
    fail('TAX_EXPENSE_BRANCH_FORBIDDEN', 'Cannot access tax expenses from another branch', 403);
  }

  return Object.freeze({
    branchId: actorBranchId,
    employeeId: Number(user.employeeId),
  });
};

module.exports = Object.freeze({ resolveTaxExpenseAuthority });
