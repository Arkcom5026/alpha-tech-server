const { number } = require('../utils/saleReturnMoney');

const projectReturnLines = (saleReturn) => [
  ...(saleReturn.items || []).map((item) => ({
    lineType: 'STOCK_ITEM',
    saleReturnItemId: item.id,
    saleItemId: item.saleItemId,
    quantity: item.quantity,
    refundAmount: item.refundAmount,
    reason: item.reason || null,
  })),
  ...(saleReturn.saleReturnItemSimples || []).map((item) => ({
    lineType: 'SIMPLE',
    saleReturnItemId: item.id,
    saleItemSimpleId: item.saleItemSimpleId,
    quantity: item.quantity,
    refundAmount: item.refundAmount,
    reason: item.reason || null,
  })),
];

const mapSaleReturnResult = ({ saleReturn, commandId, replayed }) => ({
  saleReturnId: saleReturn.id,
  branchId: saleReturn.branchId,
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
  returnLines: projectReturnLines(saleReturn),
  refunds: saleReturn.refundTransaction || [],
  idempotency: { commandId, replayed },
});

const mapSaleReturnError = (error) => ({
  code: error.code || 'SALE_RETURN_FAILED',
  message: error.message || 'Unable to complete sale return',
  details: error.details,
});

module.exports = { mapSaleReturnResult, projectReturnLines, mapSaleReturnError };
