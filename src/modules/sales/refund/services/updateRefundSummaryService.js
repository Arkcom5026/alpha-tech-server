const { prisma, Prisma } = require('../../../../../lib/prisma');
const { toDecimal } = require('../shared/refundMoney');

const updateRefundSummary = async (saleReturnId) => {
  const transactions = await prisma.refundTransaction.findMany({
    where: { saleReturnId },
    select: { amount: true, deducted: true },
  });

  const refundedAmount = transactions.reduce(
    (sum, transaction) => sum.plus(toDecimal(transaction.amount)),
    new Prisma.Decimal(0)
  );
  const deductedAmount = transactions.reduce(
    (sum, transaction) => sum.plus(toDecimal(transaction.deducted)),
    new Prisma.Decimal(0)
  );

  const saleReturn = await prisma.saleReturn.findUnique({
    where: { id: saleReturnId },
    include: { items: true },
  });

  if (!saleReturn) return;

  const totalItemRefund = saleReturn.items.reduce(
    (sum, item) => sum.plus(toDecimal(item.refundAmount)),
    new Prisma.Decimal(0)
  );
  const settledAmount = refundedAmount.plus(deductedAmount);
  const isFullyRefunded = settledAmount.gte(totalItemRefund);

  await prisma.saleReturn.update({
    where: { id: saleReturnId },
    data: {
      refundedAmount,
      deductedAmount,
      isFullyRefunded,
      status: isFullyRefunded ? 'REFUNDED' : 'PARTIAL',
    },
  });
};

module.exports = {
  updateRefundSummary,
};
