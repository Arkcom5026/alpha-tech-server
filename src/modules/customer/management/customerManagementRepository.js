const { prisma } = require('../../../../lib/prisma');

const customerSelect = {
  id: true,
  userId: true,
  branchId: true,
  name: true,
  companyName: true,
  departmentName: true,
  financialOwnerCustomerId: true,
  taxId: true,
  type: true,
  createdAt: true,
  updatedAt: true,
  creditLimit: true,
  creditBalance: true,
  depositBalance_v2: true,
  outstandingDebt_v2: true,
  user: { select: { loginId: true, email: true } },
};

const customerDetailInclude = {
  user: { select: { loginId: true, email: true } },
  subdistrict: {
    include: {
      district: {
        include: {
          province: true,
        },
      },
    },
  },
  financialOwner: { select: { id: true, name: true, companyName: true, departmentName: true, taxId: true } },
  financialMembers: { select: { id: true, name: true, companyName: true, departmentName: true, taxId: true }, orderBy: { id: 'asc' } },
};

function buildSearchFilter(query) {
  const value = String(query || '').trim();
  if (!value) return {};
  const contains = { contains: value, mode: 'insensitive' };
  return {
    OR: [
      { name: contains },
      { companyName: contains },
      { departmentName: contains },
      { taxId: contains },
      { user: { loginId: contains } },
      { user: { email: contains } },
    ],
  };
}

function listCustomers({ branchId, scope, query, limit = 100 }) {
  return prisma.customerProfile.findMany({
    where: {
      branchId: scope === 'UNASSIGNED' ? null : branchId,
      ...buildSearchFilter(query),
    },
    select: customerSelect,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: Math.min(Math.max(Number(limit) || 100, 1), 200),
  });
}

function findCustomerDetail({ customerProfileId }) {
  return prisma.customerProfile.findUnique({
    where: { id: Number(customerProfileId) },
    include: customerDetailInclude,
  });
}

function claimLegacyCustomer({ customerProfileId, branchId }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.customerProfile.findUnique({
      where: { id: customerProfileId },
      select: { id: true, userId: true, branchId: true },
    });

    if (!existing) return { outcome: 'NOT_FOUND' };
    if (existing.branchId !== null) {
      return { outcome: 'ALREADY_ASSIGNED', branchId: existing.branchId };
    }

    const duplicate = await tx.customerProfile.findFirst({
      where: { branchId, userId: existing.userId },
      select: { id: true },
    });
    if (duplicate) {
      return { outcome: 'STORE_PROFILE_EXISTS', customerProfileId: duplicate.id };
    }

    const changed = await tx.customerProfile.updateMany({
      where: { id: customerProfileId, branchId: null },
      data: { branchId },
    });
    if (changed.count !== 1) return { outcome: 'CLAIM_CONFLICT' };

    const customer = await tx.customerProfile.findUnique({
      where: { id: customerProfileId },
      select: customerSelect,
    });
    return { outcome: 'CLAIMED', customer };
  });
}

module.exports = { listCustomers, findCustomerDetail, claimLegacyCustomer };
