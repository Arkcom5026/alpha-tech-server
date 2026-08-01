const { prisma, Prisma } = require('../../../../../lib/prisma');

const findSalesForClosing = ({ branchId, start, end }) =>
  prisma.sale.findMany({
    where: {
      branchId,
      status: { not: 'CANCELLED' },
      soldAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      totalAmount: true,
      totalDiscount: true,
      vat: true,
      paid: true,
      paidAmount: true,
      statusPayment: true,
      isCredit: true,
      dueDate: true,
      items: {
        select: {
          price: true,
          refundedAmount: true,
          stockItem: { select: { costPrice: true } },
        },
      },
      simpleItems: {
        select: { quantity: true, price: true, unitCost: true },
      },
    },
  });

const groupPaymentsForClosing = ({ branchId, start, end }) =>
  prisma.paymentItem.groupBy({
    by: ['paymentMethod'],
    where: {
      payment: {
        branchId,
        isCancelled: false,
        receivedAt: { gte: start, lte: end },
        sale: { branchId, status: { not: 'CANCELLED' } },
      },
    },
    _sum: { amount: true },
  });

const readDepositSignals = ({ branchId, start, end }) =>
  Promise.all([
    prisma.customerDeposit.aggregate({
      where: {
        branchId,
        status: { not: 'CANCELLED' },
        createdAt: { gte: start, lte: end },
      },
      _count: { _all: true },
      _sum: {
        cashAmount: true,
        transferAmount: true,
        cardAmount: true,
        totalAmount: true,
        usedAmount: true,
      },
    }),
    prisma.customerDeposit.aggregate({
      where: { branchId, status: 'ACTIVE' },
      _count: { _all: true },
      _sum: { totalAmount: true, usedAmount: true },
    }),
  ]);

const readCustomerReceiptSignals = async ({ branchId, start, end }) => {
  const [todayRows, outstanding] = await Promise.all([
    prisma.customerReceipt.groupBy({
      by: ['paymentMethod'],
      where: {
        branchId,
        status: 'ACTIVE',
        receivedAt: { gte: start, lte: end },
      },
      _sum: {
        totalAmount: true,
        allocatedAmount: true,
        remainingAmount: true,
      },
      _count: { _all: true },
    }),
    prisma.customerReceipt.aggregate({
      where: {
        branchId,
        status: 'ACTIVE',
        remainingAmount: { gt: new Prisma.Decimal(0) },
      },
      _count: { _all: true },
      _sum: { remainingAmount: true },
    }),
  ]);

  return { todayRows, outstanding };
};

module.exports = {
  findSalesForClosing,
  groupPaymentsForClosing,
  readDepositSignals,
  readCustomerReceiptSignals,
};
