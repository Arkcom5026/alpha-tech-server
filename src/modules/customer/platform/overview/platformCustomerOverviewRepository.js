const { prisma } = require('../../../../../lib/prisma');

const branchLocationSelect = {
  id: true,
  name: true,
  slug: true,
  subdistrict: {
    select: {
      code: true,
      nameTh: true,
      district: {
        select: {
          code: true,
          nameTh: true,
          province: { select: { code: true, nameTh: true } },
        },
      },
    },
  },
};

function buildIdentityFilter({ query, branchId, provinceCode, districtCode, relationshipStatus, customerType, accountStatus }) {
  const where = { role: 'CUSTOMER' };
  const value = String(query || '').trim();

  if (value) {
    const contains = { contains: value, mode: 'insensitive' };
    where.OR = [
      { email: contains },
      { loginId: contains },
      { customerProfiles: { some: { name: contains } } },
      { customerProfiles: { some: { companyName: contains } } },
      { customerProfiles: { some: { taxId: contains } } },
    ];
  }

  if (accountStatus === 'ENABLED') where.enabled = true;
  if (accountStatus === 'DISABLED') where.enabled = false;

  const relationshipFilters = {};
  const normalizedBranchId = Number(branchId);
  if (Number.isInteger(normalizedBranchId) && normalizedBranchId > 0) relationshipFilters.branchId = normalizedBranchId;
  if (provinceCode) {
    relationshipFilters.branch = {
      ...(relationshipFilters.branch || {}),
      subdistrict: { district: { provinceCode: String(provinceCode) } },
    };
  }
  if (districtCode) {
    relationshipFilters.branch = {
      ...(relationshipFilters.branch || {}),
      subdistrict: { districtCode: String(districtCode) },
    };
  }
  if (customerType) relationshipFilters.type = customerType;

  if (relationshipStatus === 'UNASSIGNED') relationshipFilters.branchId = null;
  else if (relationshipStatus === 'STORE' || relationshipStatus === 'MULTI_STORE') {
    relationshipFilters.branchId = relationshipFilters.branchId ?? { not: null };
  }

  if (Object.keys(relationshipFilters).length) where.customerProfiles = { some: relationshipFilters };
  return where;
}

function listPlatformIdentityOverview(filters = {}) {
  const requestedLimit = Math.min(Math.max(Number(filters.limit) || 100, 1), 200);
  const fetchLimit = filters.relationshipStatus === 'MULTI_STORE' ? 500 : requestedLimit;

  return prisma.user.findMany({
    where: buildIdentityFilter(filters),
    select: {
      id: true,
      loginId: true,
      email: true,
      enabled: true,
      createdAt: true,
      lastLoginAt: true,
      customerProfiles: {
        select: {
          id: true,
          branchId: true,
          name: true,
          companyName: true,
          departmentName: true,
          type: true,
          createdAt: true,
          updatedAt: true,
          branch: { select: branchLocationSelect },
        },
        orderBy: [{ branchId: 'asc' }, { id: 'asc' }],
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: fetchLimit,
  });
}

function listGovernanceFilterOptions() {
  return prisma.branch.findMany({ select: branchLocationSelect, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
}

module.exports = { listPlatformIdentityOverview, listGovernanceFilterOptions, buildIdentityFilter };
