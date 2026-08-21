'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const InputTaxCapability = Object.freeze({
  VIEW: 'VIEW',
  REVIEW: 'REVIEW',
  DECIDE_DUPLICATE: 'DECIDE_DUPLICATE',
  DECIDE_REPLACEMENT: 'DECIDE_REPLACEMENT',
  SELECT_FOR_FILING: 'SELECT_FOR_FILING',
  REMOVE_FROM_FILING: 'REMOVE_FROM_FILING',
  FILE: 'FILE',
  REOPEN_PERIOD: 'REOPEN_PERIOD',
  EXPORT: 'EXPORT',
  GENERATE_AUDIT_PACKAGE: 'GENERATE_AUDIT_PACKAGE',
  RESOLVE_INVESTIGATION: 'RESOLVE_INVESTIGATION',
});

const ACCOUNT_AUTHORITY_ROLES = new Set(['SUPERADMIN', 'ADMIN']);
const EMPLOYEE_AUTHORITY_ROLES = new Set(['OWNER', 'MANAGER']);
const KNOWN_CAPABILITIES = new Set(Object.values(InputTaxCapability));

const POSITION_CAPABILITY_BY_INPUT_TAX_CAPABILITY = Object.freeze({
  [InputTaxCapability.VIEW]: POSITION_CAPABILITIES.TAX_INPUT_READ,
  [InputTaxCapability.EXPORT]: POSITION_CAPABILITIES.TAX_INPUT_READ,
  [InputTaxCapability.REVIEW]: POSITION_CAPABILITIES.TAX_INPUT_REVIEW,
  [InputTaxCapability.DECIDE_DUPLICATE]: POSITION_CAPABILITIES.TAX_INPUT_REVIEW,
  [InputTaxCapability.DECIDE_REPLACEMENT]: POSITION_CAPABILITIES.TAX_INPUT_REVIEW,
  [InputTaxCapability.RESOLVE_INVESTIGATION]: POSITION_CAPABILITIES.TAX_INPUT_REVIEW,
  [InputTaxCapability.SELECT_FOR_FILING]: POSITION_CAPABILITIES.TAX_INPUT_FILING,
  [InputTaxCapability.REMOVE_FROM_FILING]: POSITION_CAPABILITIES.TAX_INPUT_FILING,
  [InputTaxCapability.FILE]: POSITION_CAPABILITIES.TAX_INPUT_FILING,
  [InputTaxCapability.GENERATE_AUDIT_PACKAGE]: POSITION_CAPABILITIES.TAX_INPUT_AUDIT,
  [InputTaxCapability.REOPEN_PERIOD]: POSITION_CAPABILITIES.TAX_INPUT_PERIOD_CONTROL,
});

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const createError = (code, message, statusCode, details) => Object.assign(new Error(message), {
  code,
  statusCode,
  ...(details ? { details } : {}),
});

const assertInputTaxAuthority = ({
  user,
  requestedBranchId,
  capability,
  accessForbiddenCode = 'INPUT_TAX_ACCESS_FORBIDDEN',
  branchForbiddenCode = 'INPUT_TAX_BRANCH_FORBIDDEN',
  branchRequiredCode = 'TAX_BRANCH_REQUIRED',
  actorRequiredCode = 'INPUT_TAX_ACTOR_REQUIRED',
  requireActor = false,
}) => {
  if (!KNOWN_CAPABILITIES.has(capability)) {
    throw createError('INPUT_TAX_CAPABILITY_UNKNOWN', 'Unknown input tax capability', 500, { capability });
  }

  const branchId = Number(requestedBranchId);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    throw createError(branchRequiredCode, 'branchId must be a positive integer', 400);
  }

  const accountRole = normalizeRole(user?.role);
  const employeeRole = normalizeRole(user?.employeeRole || user?.position);
  const isAccountAuthority = ACCOUNT_AUTHORITY_ROLES.has(accountRole);
  const requiredPositionCapability = POSITION_CAPABILITY_BY_INPUT_TAX_CAPABILITY[capability];
  const isEmployeeAuthority = hasCapability(user, requiredPositionCapability);

  if (!isAccountAuthority && !isEmployeeAuthority) {
    throw createError(accessForbiddenCode, 'Input tax capability is not permitted for this actor', 403, {
      capability,
      requiredPositionCapability,
      accountRole: accountRole || null,
      employeeRole: employeeRole || null,
    });
  }

  const authorityBranchId = Number(
    user?.branchId || user?.employeeBranchId || user?.currentBranchId || 0,
  );
  if (!isAccountAuthority && authorityBranchId > 0 && branchId !== authorityBranchId) {
    throw createError(branchForbiddenCode, 'Input tax capability cannot cross branch authority', 403, {
      capability,
      requestedBranchId: branchId,
      authorityBranchId,
    });
  }

  const actorEmployeeId = Number(user?.employeeProfileId || user?.employeeId || 0) || null;
  if (requireActor && !actorEmployeeId) {
    throw createError(actorRequiredCode, 'Input tax mutation requires an authenticated employee actor', 403, {
      capability,
    });
  }

  return Object.freeze({
    branchId,
    capability,
    requiredPositionCapability,
    accountRole,
    employeeRole,
    actorEmployeeId,
    isAccountAuthority,
  });
};

module.exports = Object.freeze({
  ACCOUNT_AUTHORITY_ROLES,
  EMPLOYEE_AUTHORITY_ROLES,
  InputTaxCapability,
  POSITION_CAPABILITY_BY_INPUT_TAX_CAPABILITY,
  assertInputTaxAuthority,
  normalizeRole,
});
