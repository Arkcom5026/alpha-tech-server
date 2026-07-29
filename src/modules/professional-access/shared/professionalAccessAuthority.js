const fail = (code, message, statusCode = 400, details) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (details !== undefined) error.details = details;
  throw error;
};

const normalizePositiveInt = (value, code, message) => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    fail(code, message);
  }
  return normalized;
};

const normalizeToken = (value) => String(value || '').trim().toUpperCase();

const isWithinEffectiveWindow = (record, now = new Date()) => {
  if (!record) return false;
  if (record.effectiveFrom && new Date(record.effectiveFrom) > now) return false;
  if (record.effectiveUntil && new Date(record.effectiveUntil) < now) return false;
  return true;
};

const assertActiveMembership = ({ membership, codePrefix = 'PROFESSIONAL_ACCESS' }) => {
  if (!membership) {
    fail(`${codePrefix}_MEMBERSHIP_REQUIRED`, 'Active external-organization membership is required', 403);
  }
  if (normalizeToken(membership.status) !== 'ACTIVE') {
    fail(`${codePrefix}_MEMBERSHIP_INACTIVE`, 'External-organization membership is not active', 403);
  }
  return membership;
};

const assertActiveAssignment = ({ assignment, now = new Date(), codePrefix = 'PROFESSIONAL_ACCESS' }) => {
  if (!assignment) {
    fail(`${codePrefix}_ASSIGNMENT_REQUIRED`, 'Active business assignment is required', 403);
  }
  if (normalizeToken(assignment.status) !== 'ACTIVE') {
    fail(`${codePrefix}_ASSIGNMENT_INACTIVE`, 'Business assignment is not active', 403);
  }
  if (!isWithinEffectiveWindow(assignment, now)) {
    const notStarted = assignment.effectiveFrom && new Date(assignment.effectiveFrom) > now;
    fail(
      `${codePrefix}_${notStarted ? 'ASSIGNMENT_NOT_STARTED' : 'ASSIGNMENT_EXPIRED'}`,
      notStarted ? 'Business assignment is not effective yet' : 'Business assignment has expired',
      403,
    );
  }
  return assignment;
};

const assertPermission = ({
  assignment,
  resource,
  action,
  branchId,
  now = new Date(),
  codePrefix = 'PROFESSIONAL_ACCESS',
}) => {
  const normalizedResource = normalizeToken(resource);
  const normalizedAction = normalizeToken(action);
  const scopes = Array.isArray(assignment?.permissionScopes) ? assignment.permissionScopes : [];

  const allowed = scopes.some((scope) => {
    if (normalizeToken(scope.status || 'ACTIVE') !== 'ACTIVE') return false;
    if (!isWithinEffectiveWindow(scope, now)) return false;
    if (normalizeToken(scope.resource) !== normalizedResource) return false;
    if (!(scope.actions || []).map(normalizeToken).includes(normalizedAction)) return false;

    const branchMode = normalizeToken(scope.branchMode);
    if (branchMode === 'ALL_BUSINESS_BRANCHES') return true;
    if (branchMode === 'NO_BRANCH_CONTEXT') return !branchId;
    if (branchMode !== 'SELECTED_BRANCHES' || !branchId) return false;
    return (scope.branchIds || []).map(Number).includes(Number(branchId));
  });

  if (!allowed) {
    fail(
      `${codePrefix}_PERMISSION_DENIED`,
      `${normalizedResource} ${normalizedAction} permission is required`,
      403,
      { resource: normalizedResource, action: normalizedAction, branchId: branchId || null },
    );
  }
};

const authorizeProfessionalAccess = async ({
  repository,
  userId,
  externalOrganizationId,
  businessId,
  resource,
  action,
  branchId,
  now = new Date(),
  codePrefix = 'PROFESSIONAL_ACCESS',
}) => {
  const normalizedUserId = normalizePositiveInt(userId, `${codePrefix}_USER_REQUIRED`, 'userId is required');
  const normalizedOrganizationId = normalizePositiveInt(
    externalOrganizationId,
    `${codePrefix}_ORGANIZATION_REQUIRED`,
    'externalOrganizationId is required',
  );
  const normalizedBusinessId = businessId
    ? normalizePositiveInt(businessId, `${codePrefix}_BUSINESS_REQUIRED`, 'businessId is required')
    : undefined;
  const normalizedBranchId = branchId
    ? normalizePositiveInt(branchId, `${codePrefix}_BRANCH_INVALID`, 'branchId must be positive')
    : undefined;

  const membership = assertActiveMembership({
    membership: await repository.findActiveMembership({
      userId: normalizedUserId,
      externalOrganizationId: normalizedOrganizationId,
    }),
    codePrefix,
  });

  if (!normalizedBusinessId) {
    return {
      ids: { userId: normalizedUserId, externalOrganizationId: normalizedOrganizationId },
      membership,
    };
  }

  const assignment = assertActiveAssignment({
    assignment: await repository.findActiveAssignment({
      externalOrganizationId: normalizedOrganizationId,
      businessId: normalizedBusinessId,
      now,
    }),
    now,
    codePrefix,
  });

  if (resource && action) {
    assertPermission({
      assignment,
      resource,
      action,
      branchId: normalizedBranchId,
      now,
      codePrefix,
    });
  }

  return {
    ids: {
      userId: normalizedUserId,
      externalOrganizationId: normalizedOrganizationId,
      businessId: normalizedBusinessId,
      branchId: normalizedBranchId,
    },
    membership,
    assignment,
  };
};

module.exports = {
  assertActiveAssignment,
  assertActiveMembership,
  assertPermission,
  authorizeProfessionalAccess,
  fail,
  isWithinEffectiveWindow,
  normalizePositiveInt,
  normalizeToken,
};
