const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const normalizePositiveInt = (value, code, message) => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) fail(code, message);
  return normalized;
};

const normalizeStatus = (value) => String(value || '').trim().toUpperCase();

const assertActiveMembership = (membership) => {
  if (!membership) fail('ACCOUNTANT_WORKSPACE_MEMBERSHIP_REQUIRED', 'External organization membership is required', 403);
  if (normalizeStatus(membership.status) !== 'ACTIVE') {
    fail('ACCOUNTANT_WORKSPACE_MEMBERSHIP_INACTIVE', 'External organization membership is not active', 403);
  }
};

const assertAssignmentAvailable = (assignment, now = new Date()) => {
  if (!assignment) fail('ACCOUNTANT_WORKSPACE_ASSIGNMENT_NOT_FOUND', 'Business assignment not found', 404);
  if (normalizeStatus(assignment.status) !== 'ACTIVE') {
    fail('ACCOUNTANT_WORKSPACE_ASSIGNMENT_INACTIVE', 'Business assignment is not active', 403);
  }
  if (assignment.effectiveFrom && new Date(assignment.effectiveFrom) > now) {
    fail('ACCOUNTANT_WORKSPACE_ASSIGNMENT_NOT_STARTED', 'Business assignment is not effective yet', 403);
  }
  if (assignment.effectiveUntil && new Date(assignment.effectiveUntil) < now) {
    fail('ACCOUNTANT_WORKSPACE_ASSIGNMENT_EXPIRED', 'Business assignment has expired', 403);
  }
};

const listBusinesses = async ({ repository, userId, externalOrganizationId, now = new Date() }) => {
  const normalizedUserId = normalizePositiveInt(
    userId,
    'ACCOUNTANT_WORKSPACE_USER_REQUIRED',
    'userId must be a positive integer',
  );
  const normalizedOrganizationId = normalizePositiveInt(
    externalOrganizationId,
    'ACCOUNTANT_WORKSPACE_ORGANIZATION_REQUIRED',
    'externalOrganizationId must be a positive integer',
  );

  const membership = await repository.findActiveMembership({
    userId: normalizedUserId,
    externalOrganizationId: normalizedOrganizationId,
  });
  assertActiveMembership(membership);

  const assignments = await repository.listActiveAssignments({
    externalOrganizationId: normalizedOrganizationId,
    now,
  });

  return {
    externalOrganizationId: normalizedOrganizationId,
    membership: {
      id: membership.id,
      role: membership.role,
      status: membership.status,
    },
    businesses: assignments.map((assignment) => ({
      assignmentId: assignment.id,
      businessId: assignment.business.id,
      businessName: assignment.business.name,
      businessStatus: assignment.business.status,
      effectiveFrom: assignment.effectiveFrom,
      effectiveUntil: assignment.effectiveUntil,
      permissionScopeCount: assignment.permissionScopes.length,
      resources: [...new Set(assignment.permissionScopes.map((scope) => scope.resource))].sort(),
    })),
  };
};

const getBusinessWorkspace = async ({
  repository,
  userId,
  externalOrganizationId,
  businessId,
  now = new Date(),
}) => {
  const normalizedUserId = normalizePositiveInt(
    userId,
    'ACCOUNTANT_WORKSPACE_USER_REQUIRED',
    'userId must be a positive integer',
  );
  const normalizedOrganizationId = normalizePositiveInt(
    externalOrganizationId,
    'ACCOUNTANT_WORKSPACE_ORGANIZATION_REQUIRED',
    'externalOrganizationId must be a positive integer',
  );
  const normalizedBusinessId = normalizePositiveInt(
    businessId,
    'ACCOUNTANT_WORKSPACE_BUSINESS_REQUIRED',
    'businessId must be a positive integer',
  );

  const membership = await repository.findActiveMembership({
    userId: normalizedUserId,
    externalOrganizationId: normalizedOrganizationId,
  });
  assertActiveMembership(membership);

  const assignment = await repository.findAssignment({
    externalOrganizationId: normalizedOrganizationId,
    businessId: normalizedBusinessId,
    now,
  });
  assertAssignmentAvailable(assignment, now);

  return {
    externalOrganizationId: normalizedOrganizationId,
    membership: {
      id: membership.id,
      role: membership.role,
      status: membership.status,
    },
    assignment: {
      id: assignment.id,
      status: assignment.status,
      effectiveFrom: assignment.effectiveFrom,
      effectiveUntil: assignment.effectiveUntil,
    },
    business: assignment.business,
    branches: assignment.business.branches,
    permissionScopes: assignment.permissionScopes.map((scope) => ({
      id: scope.id,
      resource: scope.resource,
      actions: scope.actions,
      branchMode: scope.branchMode,
      branchIds: scope.branchIds,
      constraints: scope.constraints,
      effectiveFrom: scope.effectiveFrom,
      effectiveUntil: scope.effectiveUntil,
    })),
  };
};

module.exports = {
  getBusinessWorkspace,
  listBusinesses,
};
