const {
  SALE_RETURN_ITEM_KIND,
  SALE_RETURN_REFUND_METHOD,
} = require('../contracts/saleReturnContract');
const { SaleReturnError } = require('../contracts/saleReturnError');
const { SaleReturnFailureCode } = require('../contracts/saleReturnFailureCode');
const { createSaleReturnRequestHash } = require('../utils/saleReturnHash');

const parseAmount = (value, field) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new SaleReturnError(400, SaleReturnFailureCode.INVALID_AMOUNT, `${field} must be a non-negative number`);
  }
  return Number(amount.toFixed(2));
};

const validateSaleReturnCommand = (body = {}) => {
  const commandId = String(body.commandId || '').trim();
  const saleId = Number(body.saleId);
  const reason = String(body.reason || '').trim();
  if (!commandId || commandId.length > 120) {
    throw new SaleReturnError(400, SaleReturnFailureCode.INVALID_COMMAND_ID, 'commandId is required');
  }
  if (!Number.isInteger(saleId) || saleId <= 0) {
    throw new SaleReturnError(400, SaleReturnFailureCode.INVALID_SALE_ID, 'saleId is invalid');
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new SaleReturnError(400, SaleReturnFailureCode.ITEMS_REQUIRED, 'Select at least one item');
  }

  const seen = new Set();
  const items = body.items.map((item, index) => {
    const kind = item.kind === SALE_RETURN_ITEM_KIND.SIMPLE
      ? SALE_RETURN_ITEM_KIND.SIMPLE
      : SALE_RETURN_ITEM_KIND.SERIALIZED;
    const id = Number(kind === SALE_RETURN_ITEM_KIND.SIMPLE ? item.saleItemSimpleId : item.saleItemId);
    const quantity = kind === SALE_RETURN_ITEM_KIND.SIMPLE
      ? parseAmount(item.quantity, `items[${index}].quantity`)
      : 1;
    const identity = `${kind}:${id}`;
    if (!Number.isInteger(id) || id <= 0 || quantity <= 0 || seen.has(identity)) {
      throw new SaleReturnError(400, SaleReturnFailureCode.INVALID_ITEM, `items[${index}] is invalid or duplicated`);
    }
    seen.add(identity);
    return {
      kind,
      saleItemId: kind === SALE_RETURN_ITEM_KIND.SERIALIZED ? id : null,
      saleItemSimpleId: kind === SALE_RETURN_ITEM_KIND.SIMPLE ? id : null,
      quantity,
      refundAmount: parseAmount(item.refundAmount, `items[${index}].refundAmount`),
      reason: String(item.reason || reason || '').trim(),
    };
  });

  const allowedMethods = new Set(Object.values(SALE_RETURN_REFUND_METHOD));
  const refunds = (body.refunds || []).map((refund, index) => {
    const method = String(refund.method || '').trim();
    if (!allowedMethods.has(method)) {
      throw new SaleReturnError(400, SaleReturnFailureCode.INVALID_AMOUNT, `refunds[${index}].method is invalid`);
    }
    return {
      method,
      amount: parseAmount(refund.amount, `refunds[${index}].amount`),
      sourcePaymentItemId: refund.sourcePaymentItemId ? Number(refund.sourcePaymentItemId) : null,
      referenceNo: String(refund.referenceNo || '').trim() || null,
      note: String(refund.note || '').trim() || null,
    };
  }).filter((refund) => refund.amount > 0);

  const material = { saleId, reason, items, refunds };
  return {
    commandId,
    saleId,
    reason,
    items,
    refunds,
    requestHash: createSaleReturnRequestHash(material),
  };
};

module.exports = { validateSaleReturnCommand };
