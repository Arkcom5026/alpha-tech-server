const { prisma } = require('../../../../../lib/prisma');
const {
  buildCustomerBranchEvidence,
} = require('../../../customer/policies/customerBranchAccessPolicy');
const {
  getCustomerMoneySourceState,
} = require('../../../customer-money/balance/customerMoneySourcePoolService');

const createDeposit = ({ data, client = prisma }) => client.customerDeposit.create({
  data,
  include: { customer: { include: { user: true } } },
});

const findActiveDepositsByBranch = (branchId) => prisma.customerDeposit.findMany({
  where: { branchId, status: 'ACTIVE' },
  orderBy: { createdAt: 'desc' },
  include: { customer: { include: { user: true } } },
});

const findActiveDepositByIdAndBranch = ({ id, branchId, client = prisma }) => client.customerDeposit.findFirst({
  where: { id, branchId, status: 'ACTIVE' },
  include: { customer: { include: { user: true } } },
});

const findCustomerByPhone = ({ phone, branchId, client = prisma }) => client.customerProfile.findFirst({
  where: {
    AND: [
      buildCustomerBranchEvidence(branchId),
      { user: { loginId: phone } },
    ],
  },
  include: {
    user: true,
    subdistrict: { include: { district: { include: { province: true } } } },
    customerDeposits: {
      where: { branchId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    },
  },
});

const findCustomersByName = ({ query, branchId, client = prisma }) => client.customerProfile.findMany({
  where: {
    AND: [
      buildCustomerBranchEvidence(branchId),
      {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { companyName: { contains: query, mode: 'insensitive' } },
        ],
      },
    ],
  },
  take: 10,
  orderBy: [{ companyName: 'asc' }, { name: 'asc' }, { id: 'asc' }],
  include: {
    user: true,
    subdistrict: { include: { district: { include: { province: true } } } },
    customerDeposits: {
      where: { branchId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    },
  },
});

const findCustomerById = ({ customerId, branchId, client = prisma }) => client.customerProfile.findFirst({
  where: {
    id: customerId,
    ...buildCustomerBranchEvidence(branchId),
  },
  include: {
    user: true,
    subdistrict: { include: { district: { include: { province: true } } } },
    customerDeposits: {
      where: { branchId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    },
  },
});

const buildDepositReservationError = () => {
  const error = new Error('ยอดเงินมัดจำส่วนนี้ถูกกันไว้รองรับรายการตัดยอด Customer Money เดิม');
  error.statusCode = 409;
  error.code = 'DEPOSIT_CUSTOMER_MONEY_RESERVED';
  return error;
};

const updateDepositById = async ({ id, data, client = prisma }) => {
  if (data?.usedAmount !== undefined && client?.customerDeposit?.findUnique) {
    const current = await client.customerDeposit.findUnique({
      where: { id },
      select: { branchId: true, customerId: true, usedAmount: true },
    });
    const nextUsedAmount = Number(data.usedAmount);
    const currentUsedAmount = Number(current?.usedAmount || 0);
    const spendAmount = nextUsedAmount - currentUsedAmount;

    if (current?.branchId && current?.customerId && spendAmount > 0.0001) {
      const sourceState = await getCustomerMoneySourceState(client, {
        branchId: current.branchId,
        customerId: current.customerId,
        sourceType: 'CUSTOMER_DEPOSIT',
        sourceId: id,
      });
      if (
        !sourceState.source
        || sourceState.uncoveredLegacyReservation.greaterThan(0)
        || spendAmount > Number(sourceState.availableAmount) + 0.0001
      ) {
        throw buildDepositReservationError();
      }
    }
  }

  return client.customerDeposit.update({
    where: { id },
    data,
    include: { customer: { include: { user: true } } },
  });
};

const deleteDepositById = ({ id, client = prisma }) => client.customerDeposit.delete({ where: { id } });

const findActiveDepositBalancesByCustomer = ({ customerId, branchId, client = prisma }) => (
  client.customerDeposit.findMany({
    where: { customerId, branchId, status: 'ACTIVE' },
    select: { totalAmount: true, usedAmount: true },
  })
);

const findActiveMoneyReceiptBalancesByCustomer = ({ customerId, branchId, client = prisma }) => (
  client.customerReceipt.findMany({
    where: {
      customerId,
      branchId,
      status: 'ACTIVE',
      code: { startsWith: 'CMR-' },
    },
    select: { remainingAmount: true },
  })
);

const runTransaction = (callback, options) => prisma.$transaction(callback, options);

module.exports = {
  createDeposit,
  findActiveDepositsByBranch,
  findActiveDepositByIdAndBranch,
  findCustomerByPhone,
  findCustomersByName,
  findCustomerById,
  updateDepositById,
  findActiveDepositBalancesByCustomer,
  findActiveMoneyReceiptBalancesByCustomer,
  deleteDepositById,
  runTransaction,
};