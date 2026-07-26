const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const GLOBAL_TAX_ADMIN_ROLES = Object.freeze(['SUPERADMIN', 'ADMIN']);
const BRANCH_TAX_ADMIN_ROLES = Object.freeze(['OWNER', 'MANAGER']);

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const requirePositiveBranchId = (value, field) => {
  const branchId = Number(value);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_ADMINISTRATIVE_BRANCH_SCOPE',
      `${field} must be a positive branch id`,
      { field, value },
    );
  }
  return branchId;
};

const resolveTaxAdministratorScope = (user = {}) => {
  const accountRole = normalizeRole(user.role);
  const employeeRole = normalizeRole(user.employeeRole);

  if (GLOBAL_TAX_ADMIN_ROLES.includes(accountRole)) {
    return Object.freeze({ scope: 'GLOBAL', branchId: null, accountRole, employeeRole });
  }

  if (BRANCH_TAX_ADMIN_ROLES.includes(employeeRole)) {
    return Object.freeze({
      scope: 'BRANCH',
      branchId: requirePositiveBranchId(user.branchId, 'req.user.branchId'),
      accountRole,
      employeeRole,
    });
  }

  throw new TaxDocumentContractError(
    'TAX_PERIOD_ADMINISTRATIVE_ACCESS_FORBIDDEN',
    'Tax Period administration requires authorized account or employee authority',
    { accountRole, employeeRole },
  );
};

const assertBranchScope = ({ administrator, branchId }) => {
  const requestedBranchId = requirePositiveBranchId(branchId, 'branchId');
  if (administrator.scope === 'GLOBAL') return requestedBranchId;

  if (administrator.branchId !== requestedBranchId) {
    throw new TaxDocumentContractError(
      'TAX_PERIOD_ADMINISTRATIVE_BRANCH_FORBIDDEN',
      'Tax Period administration cannot access another branch',
      {
        administratorBranchId: administrator.branchId,
        requestedBranchId,
      },
    );
  }

  return requestedBranchId;
};

const assertReadinessBranchScope = ({ administrator, branchIds }) => {
  if (!Array.isArray(branchIds)) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_ADMINISTRATIVE_BRANCH_SCOPE',
      'Tax Period readiness branchIds must be an array',
      { branchIds },
    );
  }

  const requestedBranchIds = [...new Set(
    branchIds.map((branchId) => requirePositiveBranchId(branchId, 'branchIds')),
  )];

  if (administrator.scope === 'GLOBAL') return Object.freeze(requestedBranchIds);

  const forbiddenBranchIds = requestedBranchIds.filter(
    (branchId) => branchId !== administrator.branchId,
  );

  if (forbiddenBranchIds.length > 0) {
    throw new TaxDocumentContractError(
      'TAX_PERIOD_ADMINISTRATIVE_BRANCH_FORBIDDEN',
      'Tax Period readiness cannot include another branch',
      {
        administratorBranchId: administrator.branchId,
        forbiddenBranchIds,
      },
    );
  }

  return Object.freeze(requestedBranchIds);
};

module.exports = {
  BRANCH_TAX_ADMIN_ROLES,
  GLOBAL_TAX_ADMIN_ROLES,
  assertBranchScope,
  assertReadinessBranchScope,
  normalizeRole,
  requirePositiveBranchId,
  resolveTaxAdministratorScope,
};
