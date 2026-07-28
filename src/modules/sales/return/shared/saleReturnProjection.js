const { Prisma } = require('../../../../lib/prisma');

const D = (value) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value ?? 0);

const toNum = (value) =>
  value && typeof value.toNumber === 'function' ? value.toNumber() : Number(value || 0);

const toInt = (value) =>
  value === undefined || value === null || value === '' ? undefined : parseInt(value, 10);

const projectSaleReturnSummary = (saleReturn) => {
  const totalItemRefundDec = (saleReturn.items || []).reduce(
    (sum, item) => sum.plus(D(item.refundAmount)),
    new Prisma.Decimal(0),
  );
  const refundedAmountDec = D(saleReturn.refundedAmount);
  const deductedAmountDec = D(saleReturn.deductedAmount);
  const settledAmountDec = refundedAmountDec.plus(deductedAmountDec);

  return {
    ...saleReturn,
    totalRefund: toNum(totalItemRefundDec),
    refundedAmount: toNum(refundedAmountDec),
    deductedAmount: toNum(deductedAmountDec),
    remainingAmount: toNum(totalItemRefundDec.minus(settledAmountDec)),
    isFullyRefunded: settledAmountDec.gte(totalItemRefundDec),
  };
};

const projectSaleReturnDetail = (saleReturn) => {
  const totalItemRefundDec = (saleReturn.items || []).reduce(
    (sum, item) => sum.plus(D(item.refundAmount)),
    new Prisma.Decimal(0),
  );
  const refundedAmountDec = (saleReturn.refundTransaction || []).reduce(
    (sum, refund) => sum.plus(D(refund.amount)),
    new Prisma.Decimal(0),
  );
  const deductedAmountDec = (saleReturn.refundTransaction || []).reduce(
    (sum, refund) => sum.plus(D(refund.deducted)),
    new Prisma.Decimal(0),
  );
  const settledAmountDec = refundedAmountDec.plus(deductedAmountDec);

  return {
    ...saleReturn,
    totalRefund: toNum(totalItemRefundDec),
    refundedAmount: toNum(refundedAmountDec),
    deductedAmount: toNum(deductedAmountDec),
    remainingAmount: toNum(totalItemRefundDec.minus(settledAmountDec)),
    isFullyRefunded: settledAmountDec.gte(totalItemRefundDec),
  };
};

module.exports = {
  toInt,
  projectSaleReturnSummary,
  projectSaleReturnDetail,
};
