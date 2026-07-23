const crypto = require('node:crypto');
const { SaleCompletionError: SalesError } = require('./saleCompletionError');
const {
  isImmediateSalePaymentMethod,
  normalizeSalePaymentMethod,
} = require('../policies/salePaymentPolicy');

const money = (value, field, { allowZero = true } = {}) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (!allowZero && number === 0)) {
    throw new SalesError(400, 'SALE_VALIDATION_FAILED', `Invalid ${field}`);
  }
  return Math.round(number * 100) / 100;
};

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      if (value[key] !== undefined) out[key] = stable(value[key]);
      return out;
    }, {});
  }
  return value;
};

const parseCompleteSaleCommand = (body = {}) => {
  const commandKey = String(body.commandId || body.idempotencyKey || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(commandKey)) {
    throw new SalesError(400, 'INVALID_COMMAND_ID', 'A stable commandId (16-128 characters) is required');
  }

  const sale = body.sale || body;
  const payment = body.payment || { paymentItems: body.paymentItems };
  const mode = String(sale.mode || sale.saleMode || 'CASH').toUpperCase();
  if (!['CASH', 'CREDIT'].includes(mode)) {
    throw new SalesError(400, 'INVALID_SALE_MODE', 'mode must be CASH or CREDIT');
  }
  const items = Array.isArray(sale.items) ? sale.items : [];
  if (!items.length) throw new SalesError(400, 'SALE_ITEMS_REQUIRED', 'At least one sale item is required');

  const stockIds = items.map((item) => Number(item.stockItemId));
  if (stockIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new SalesError(400, 'STOCK_ITEM_REQUIRED', 'Every item requires a valid stockItemId');
  }
  if (new Set(stockIds).size !== stockIds.length) {
    throw new SalesError(400, 'DUPLICATE_STOCK_ITEM', 'The same stock item cannot be sold twice');
  }

  const normalizedItems = items.map((item) => ({
    stockItemId: Number(item.stockItemId),
    productId: item.productId == null ? null : Number(item.productId),
    basePrice: money(item.basePrice, 'item.basePrice'),
    vatAmount: money(item.vatAmount, 'item.vatAmount'),
    price: money(item.price, 'item.price'),
    discount: money(item.discount || 0, 'item.discount'),
    remark: item.remark || null,
    documentPrefix: item.documentPrefix ?? null,
    documentDescription: item.documentDescription ?? null,
    documentSuffix: item.documentSuffix ?? null,
  }));

  const totalBeforeDiscount = money(sale.totalBeforeDiscount, 'totalBeforeDiscount');
  const totalDiscount = money(sale.totalDiscount || 0, 'totalDiscount');
  const totalAmount = money(sale.totalAmount, 'totalAmount');
  const vatRate = money(sale.vatRate == null ? 7 : sale.vatRate, 'vatRate');
  const vat = money(sale.vat, 'vat');
  const sumBase = money(normalizedItems.reduce((sum, item) => sum + item.basePrice, 0), 'sumBase');
  const sumDiscount = money(normalizedItems.reduce((sum, item) => sum + item.discount, 0), 'sumDiscount');
  const sumPrice = money(normalizedItems.reduce((sum, item) => sum + item.price, 0), 'sumPrice');
  const expectedVat = money(totalAmount * vatRate / (100 + vatRate), 'expectedVat');
  const mismatch = (a, b) => Math.abs(a - b) > 0.01;
  if (mismatch(totalBeforeDiscount, sumBase) || mismatch(totalDiscount, sumDiscount) ||
      mismatch(totalAmount, sumPrice) || mismatch(totalAmount, totalBeforeDiscount - totalDiscount) ||
      mismatch(vat, expectedVat)) {
    throw new SalesError(400, 'SALE_TOTAL_MISMATCH', 'Sale totals or VAT do not match item evidence', {
      totalBeforeDiscount, totalDiscount, totalAmount, vat, expectedVat, sumBase, sumDiscount, sumPrice,
    });
  }

  const customerId = sale.customerId == null ? null : Number(sale.customerId);
  if (mode === 'CREDIT' && !customerId) {
    throw new SalesError(400, 'CREDIT_CUSTOMER_REQUIRED', 'Credit sale requires a customer');
  }

  const paymentItems = (Array.isArray(payment.paymentItems) ? payment.paymentItems : [])
    .filter((item) => Number(item.amount) > 0)
    .map((item) => ({
      paymentMethod: normalizeSalePaymentMethod(item.paymentMethod),
      amount: money(item.amount, 'payment.amount', { allowZero: false }),
      note: item.note || null,
      slipImage: item.slipImage || null,
      cardRef: item.cardRef || null,
      govImage: item.govImage || null,
      customerDepositId: item.customerDepositId == null ? null : Number(item.customerDepositId),
    }));
  const immediate = paymentItems.filter((item) => isImmediateSalePaymentMethod(item.paymentMethod));
  if (mode === 'CREDIT' && immediate.length) {
    throw new SalesError(400, 'CREDIT_IMMEDIATE_PAYMENT_FORBIDDEN', 'Credit sale cannot include immediate cash, transfer, or card payment');
  }
  if (paymentItems.some((item) => !['CASH', 'TRANSFER', 'CARD', 'DEPOSIT'].includes(item.paymentMethod))) {
    throw new SalesError(400, 'INVALID_PAYMENT_METHOD', 'Unsupported payment method');
  }
  if (paymentItems.some((item) => item.paymentMethod === 'DEPOSIT' && !item.customerDepositId)) {
    throw new SalesError(400, 'DEPOSIT_ID_REQUIRED', 'Deposit payment requires customerDepositId');
  }
  const paymentTotal = money(paymentItems.reduce((sum, item) => sum + item.amount, 0), 'paymentTotal');
  if (paymentTotal > totalAmount + 0.01) {
    throw new SalesError(400, 'PAYMENT_EXCEEDS_TOTAL', 'Applied payment exceeds sale total');
  }
  if (mode === 'CASH' && mismatch(paymentTotal, totalAmount)) {
    throw new SalesError(400, 'PAYMENT_TOTAL_REQUIRED', 'Cash completion requires payment evidence for the net sale total');
  }

  const command = {
    commandKey,
    sale: {
      customerId, totalBeforeDiscount, totalDiscount, totalAmount, vat, vatRate,
      note: sale.note || null, items: normalizedItems, mode,
      isCredit: mode === 'CREDIT', isTaxInvoice: mode === 'CREDIT' ? false : !!sale.isTaxInvoice,
      saleType: sale.saleType || undefined,
      deliveryNoteMode: sale.deliveryNoteMode || undefined,
    },
    payment: {
      note: payment.note || null,
      receivedAt: payment.receivedAt || null,
      paymentItems,
      total: paymentTotal,
    },
  };
  command.requestHash = crypto.createHash('sha256').update(JSON.stringify(stable(command))).digest('hex');
  return command;
};

module.exports = { parseCompleteSaleCommand };
