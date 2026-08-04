const repository = require('./platformCustomerOverviewRepository');

function presentIdentity(user) {
  const storeRelationships = user.customerProfiles
    .filter((profile) => profile.branchId !== null)
    .map((profile) => ({
      customerProfileId: profile.id,
      branchId: profile.branchId,
      branchName: profile.branch?.name || '',
      branchSlug: profile.branch?.slug || '',
      displayName: profile.companyName || profile.name || '',
    }));
  const unassignedRelationships = user.customerProfiles
    .filter((profile) => profile.branchId === null)
    .map((profile) => ({
      customerProfileId: profile.id,
      displayName: profile.companyName || profile.name || '',
    }));

  return {
    userId: user.id,
    loginId: user.loginId || '',
    email: user.email || '',
    enabled: user.enabled,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    storeRelationshipCount: storeRelationships.length,
    unassignedRelationshipCount: unassignedRelationships.length,
    storeRelationships,
    unassignedRelationships,
    platformCustomerStatus: 'NOT_ESTABLISHED',
  };
}

async function getOverview({ userContext = {}, query, limit }) {
  if (String(userContext.role || '') !== 'SUPERADMIN') {
    return {
      status: 403,
      body: { code: 'PLATFORM_CUSTOMER_GOVERNANCE_FORBIDDEN', message: 'Forbidden' },
    };
  }

  const users = await repository.listPlatformIdentityOverview({ query, limit });
  return {
    status: 200,
    body: {
      count: users.length,
      mode: 'READ_ONLY',
      platformCustomerContract: 'EXPLICIT_PLATFORM_COMMERCE_RELATIONSHIP_REQUIRED',
      results: users.map(presentIdentity),
    },
  };
}

module.exports = { getOverview, presentIdentity };
