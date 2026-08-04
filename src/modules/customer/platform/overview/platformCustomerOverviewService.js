const repository = require('./platformCustomerOverviewRepository');

const RELATIONSHIP_STATUSES = new Set(['ALL', 'STORE', 'UNASSIGNED', 'MULTI_STORE']);
const ACCOUNT_STATUSES = new Set(['ALL', 'ENABLED', 'DISABLED']);
const CUSTOMER_TYPES = new Set(['INDIVIDUAL', 'COMPANY', 'GOVERNMENT']);

function presentIdentity(user) {
  const storeRelationships = user.customerProfiles
    .filter((profile) => profile.branchId !== null)
    .map((profile) => ({
      customerProfileId: profile.id,
      branchId: profile.branchId,
      branchName: profile.branch?.name || '',
      branchSlug: profile.branch?.slug || '',
      customerType: profile.type,
      displayName: profile.companyName || profile.name || '',
      subdistrictCode: profile.branch?.subdistrict?.code || '',
      subdistrictName: profile.branch?.subdistrict?.nameTh || '',
      districtCode: profile.branch?.subdistrict?.district?.code || '',
      districtName: profile.branch?.subdistrict?.district?.nameTh || '',
      provinceCode: profile.branch?.subdistrict?.district?.province?.code || '',
      provinceName: profile.branch?.subdistrict?.district?.province?.nameTh || '',
    }));
  const unassignedRelationships = user.customerProfiles
    .filter((profile) => profile.branchId === null)
    .map((profile) => ({
      customerProfileId: profile.id,
      customerType: profile.type,
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
    relationshipStatus:
      storeRelationships.length > 1
        ? 'MULTI_STORE'
        : storeRelationships.length === 1
          ? 'STORE'
          : unassignedRelationships.length > 0
            ? 'UNASSIGNED'
            : 'NO_RELATIONSHIP',
    storeRelationships,
    unassignedRelationships,
    platformCustomerStatus: 'NOT_ESTABLISHED',
  };
}

function normalizeFilters(input = {}) {
  const relationshipStatus = String(input.relationshipStatus || 'ALL').toUpperCase();
  const accountStatus = String(input.accountStatus || 'ALL').toUpperCase();
  const customerType = String(input.customerType || '').toUpperCase();

  return {
    query: String(input.query || '').trim(),
    branchId: input.branchId || '',
    provinceCode: String(input.provinceCode || '').trim(),
    districtCode: String(input.districtCode || '').trim(),
    relationshipStatus: RELATIONSHIP_STATUSES.has(relationshipStatus) ? relationshipStatus : 'ALL',
    accountStatus: ACCOUNT_STATUSES.has(accountStatus) ? accountStatus : 'ALL',
    customerType: CUSTOMER_TYPES.has(customerType) ? customerType : '',
    limit: Math.min(Math.max(Number(input.limit) || 100, 1), 200),
  };
}

function presentFilterOptions(branches) {
  const provinces = new Map();
  const districts = new Map();

  const branchOptions = branches.map((branch) => {
    const district = branch.subdistrict?.district;
    const province = district?.province;
    if (province?.code) provinces.set(province.code, { code: province.code, name: province.nameTh });
    if (district?.code) {
      districts.set(district.code, {
        code: district.code,
        name: district.nameTh,
        provinceCode: province?.code || '',
      });
    }
    return {
      id: branch.id,
      name: branch.name,
      slug: branch.slug || '',
      districtCode: district?.code || '',
      provinceCode: province?.code || '',
    };
  });

  return {
    branches: branchOptions,
    provinces: [...provinces.values()].sort((a, b) => a.name.localeCompare(b.name, 'th')),
    districts: [...districts.values()].sort((a, b) => a.name.localeCompare(b.name, 'th')),
    relationshipStatuses: ['ALL', 'STORE', 'UNASSIGNED', 'MULTI_STORE'],
    customerTypes: ['INDIVIDUAL', 'COMPANY', 'GOVERNMENT'],
    accountStatuses: ['ALL', 'ENABLED', 'DISABLED'],
  };
}

async function getOverview({ userContext = {}, ...input }) {
  if (String(userContext.role || '') !== 'SUPERADMIN') {
    return {
      status: 403,
      body: { code: 'PLATFORM_CUSTOMER_GOVERNANCE_FORBIDDEN', message: 'Forbidden' },
    };
  }

  const filters = normalizeFilters(input);
  const [users, branches] = await Promise.all([
    repository.listPlatformIdentityOverview(filters),
    repository.listGovernanceFilterOptions(),
  ]);

  let results = users.map(presentIdentity);
  if (filters.relationshipStatus === 'MULTI_STORE') {
    results = results.filter((identity) => identity.storeRelationshipCount > 1);
  }
  results = results.slice(0, filters.limit);

  return {
    status: 200,
    body: {
      count: results.length,
      mode: 'READ_ONLY',
      platformCustomerContract: 'EXPLICIT_PLATFORM_COMMERCE_RELATIONSHIP_REQUIRED',
      appliedFilters: filters,
      filterOptions: presentFilterOptions(branches),
      summary: {
        identities: results.length,
        storeRelationships: results.reduce((sum, item) => sum + item.storeRelationshipCount, 0),
        unassignedRelationships: results.reduce((sum, item) => sum + item.unassignedRelationshipCount, 0),
        multiStoreIdentities: results.filter((item) => item.storeRelationshipCount > 1).length,
      },
      results,
    },
  };
}

module.exports = { getOverview, presentIdentity, normalizeFilters, presentFilterOptions };
