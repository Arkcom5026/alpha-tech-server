const {
  authorizeProfessionalAccess,
  normalizePositiveInt,
} = require('../shared/professionalAccessAuthority');

const listBusinesses = async ({ repository, userId, externalOrganizationId, now = new Date() }) => {
  const { ids, membership } = await authorizeProfessionalAccess({
    repository,
    userId,
    externalOrganizationId,
    now,
    codePrefix: 'ACCOUNTANT_WORKSPACE',
  });

  const assignments = await repository.listActiveAssignments({
    externalOrganizationId: ids.externalOrganizationId,
    now,
  });

  return {
    externalOrganizationId: ids.externalOrganizationId,
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
  const normalizedBusinessId = normalizePositiveInt(
    businessId,
    'ACCOUNTANT_WORKSPACE_BUSINESS_REQUIRED',
    'businessId must be a positive integer',
  );

  const { ids, membership, assignment } = await authorizeProfessionalAccess({
    repository,
    userId,
    externalOrganizationId,
    businessId: normalizedBusinessId,
    now,
    codePrefix: 'ACCOUNTANT_WORKSPACE',
  });

  return {
    externalOrganizationId: ids.externalOrganizationId,
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
