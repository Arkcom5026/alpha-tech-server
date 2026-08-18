const { prisma } = require('../../../../lib/prisma');
const {
  buildActiveCreditReceivableWhere,
  calculateOutstandingReceivable,
} = require('../../sales/shared/creditReceivableAuthority');

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
  quotationWorkflowOverride: true,
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

const number = (value) => Number(value || 0);

async function getFinancialProjection({ branchId, customers }) {
  if (!customers.length || !Number.isInteger(Number(branchId))) return new Map();

  const requestedCustomerIds = customers.map((customer) => customer.id);
  const requestedOwnerIds = [...new Set(customers.map((customer) => customer.financialOwnerCustomerId || customer.id))];

  // Resolve only groups represented in this page. Query count stays constant without scanning every branch customer.
  const profiles = await prisma.customerProfile.findMany({
    where: {
      branchId,
      OR: [
        { id: { in: requestedOwnerIds } },
        { id: { in: requestedCustomerIds } },
        { financialOwnerCustomerId: { in: requestedOwnerIds } },
      ],
    },
    select: { id: true, branchId: true, companyName: true, departmentName: true, financialOwnerCustomerId: true },
  });
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const requestedIds = new Set(requestedCustomerIds);
  const ownerIds = new Set(requestedOwnerIds);
  const relevantProfiles = profiles.filter((profile) => ownerIds.has(profile.financialOwnerCustomerId || profile.id));
  const relevantIds = relevantProfiles.map((profile) => profile.id);

  const [sales, receipts, deposits, legacyReservations] = await Promise.all([
    prisma.sale.findMany({
      where: {
        ...buildActiveCreditReceivableWhere({ branchId, customerIds: relevantIds }),
      },
      select: { customerId: true, totalAmount: true, paidAmount: true },
    }),
    prisma.customerReceipt.findMany({
      where: { branchId, customerId: { in: relevantIds }, status: 'ACTIVE', code: { startsWith: 'CMR-' }, remainingAmount: { gt: 0 } },
      select: { customerId: true, remainingAmount: true },
    }),
    prisma.customerDeposit.findMany({
      where: { branchId, customerId: { in: relevantIds }, status: 'ACTIVE' },
      select: { customerId: true, totalAmount: true, usedAmount: true },
    }),
    prisma.customerMoneySettlementLine.findMany({
      where: {
        settlement: { branchId, customerId: { in: relevantIds }, status: 'ACTIVE', settlementType: 'DELIVERY_CREDIT' },
        application: { sourceType: 'CUSTOMER_MONEY_BALANCE', status: 'APPLIED' },
      },
      select: { appliedAmount: true, settlement: { select: { customerId: true } } },
    }),
  ]);

  const debtByCustomer = new Map();
  for (const sale of sales) {
    const debt = calculateOutstandingReceivable(sale);
    debtByCustomer.set(sale.customerId, number(debtByCustomer.get(sale.customerId)) + debt);
  }
  const moneyByCustomer = new Map();
  for (const receipt of receipts) moneyByCustomer.set(receipt.customerId, number(moneyByCustomer.get(receipt.customerId)) + number(receipt.remainingAmount));
  for (const deposit of deposits) moneyByCustomer.set(deposit.customerId, number(moneyByCustomer.get(deposit.customerId)) + Math.max(0, number(deposit.totalAmount) - number(deposit.usedAmount)));
  for (const line of legacyReservations) moneyByCustomer.set(line.settlement.customerId, number(moneyByCustomer.get(line.settlement.customerId)) - number(line.appliedAmount));

  const result = new Map();
  for (const customer of customers) {
    if (!requestedIds.has(customer.id)) continue;
    const ownerId = customer.financialOwnerCustomerId || customer.id;
    const owner = profileById.get(ownerId);
    const members = relevantProfiles.filter((profile) => (profile.financialOwnerCustomerId || profile.id) === ownerId);
    const isOwner = !customer.financialOwnerCustomerId && members.some((member) => member.id !== customer.id);
    const groupIds = members.map((member) => member.id);
    result.set(customer.id, {
      financialGroupStatus: customer.financialOwnerCustomerId ? 'MEMBER' : isOwner ? 'OWNER' : 'STANDALONE',
      financialOwnerCustomerId: customer.financialOwnerCustomerId || null,
      financialOwner: customer.financialOwnerCustomerId && owner ? {
        id: owner.id,
        companyName: owner.companyName || '',
        departmentName: owner.departmentName || '',
      } : null,
      memberOutstandingDebt: number(debtByCustomer.get(customer.id)),
      groupOutstandingDebt: groupIds.reduce((sum, id) => sum + number(debtByCustomer.get(id)), 0),
      groupAvailableCustomerMoney: Math.max(0, groupIds.reduce((sum, id) => sum + number(moneyByCustomer.get(id)), 0)),
      groupMemberCount: groupIds.length,
    });
  }
  return result;
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

    const alreadyExists = await tx.customerProfile.findFirst({
      where: { userId: existing.userId, branchId },
      select: { id: true },
    });
    if (alreadyExists) return { outcome: 'STORE_PROFILE_EXISTS', customerProfileId: alreadyExists.id };

    const claimed = await tx.customerProfile.updateMany({
      where: { id: customerProfileId, branchId: null },
      data: { branchId },
    });
    if (claimed.count !== 1) return { outcome: 'CLAIM_CONFLICT' };

    const customer = await tx.customerProfile.findUnique({
      where: { id: customerProfileId },
      include: customerDetailInclude,
    });
    return { outcome: 'CLAIMED', customer };
  });
}

module.exports = {
  listCustomers,
  findCustomerDetail,
  claimLegacyCustomer,
  getFinancialProjection,
};
