const { number } = require('../utils/saleReturnMoney');

const mapSaleReturnResult = ({ saleReturn, commandId, replayed }) => ({
  saleReturnId: saleReturn.id,
  code: saleReturn.code,
  saleId: saleReturn.saleId,
  returnedAt: saleReturn.returnedAt,
  stockRestoredAt: saleReturn.stockRestoredAt,
  completedAt: saleReturn.completedAt,
  status: saleReturn.status,
  reason: saleReturn.reason,
  totals: {
    eligibleRefund: number(saleReturn.totalRefund),
    deductedAmount: number(saleReturn.deductedAmount),
    refundedAmount: number(saleReturn.refundedAmount),
  },
  items: saleReturn.items || [],
  simpleItems: saleReturn.saleReturnItemSimples || [],
  refunds: saleReturn.refundTransaction || [],
  idempotency: { commandId, replayed },
});

const mapSaleReturnError = (error) => ({
  code: error.code || 'SALE_RETURN_FAILED',
  message: error.message || 'Unable to complete sale return',
  details: error.details,
});

module.exports = { mapSaleReturnResult, mapSaleReturnError };
