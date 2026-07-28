'use strict';

const fail = (message, code, status = 400, details) => {
  throw Object.assign(new Error(message), { code, status, statusCode: status, isOperational: true, details });
};
const positiveInt = (value, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(`${field} is required`, 'HELD_CART_INPUT_INVALID');
  return parsed;
};
const money = (value, field, allowZero = true) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) fail(`${field} is invalid`, 'HELD_CART_INPUT_INVALID');
  return Math.round(parsed * 100) / 100;
};
const text = (value, max = 500) => String(value || '').trim().slice(0, max) || null;

const parseLine = (line, index) => {
  const lineType = String(line.lineType || '').trim().toUpperCase();
  if (!['STOCK_ITEM', 'SIMPLE'].includes(lineType)) fail('Unsupported held cart line type', 'HELD_CART_LINE_INVALID');
  const productId = positiveInt(line.productId, `items[${index}].productId`);
  const quantity = lineType === 'STOCK_ITEM' ? 1 : money(line.quantity, `items[${index}].quantity`, false);
  const stockItemId = lineType === 'STOCK_ITEM' ? positiveInt(line.stockItemId, `items[${index}].stockItemId`) : null;
  const simpleLotId = lineType === 'SIMPLE' && line.simpleLotId != null
    ? positiveInt(line.simpleLotId, `items[${index}].simpleLotId`)
    : null;
  const lineKey = text(line.lineId || line.lineKey, 120) || `${lineType}-${stockItemId || simpleLotId || productId}-${index}`;
  return {
    lineKey, lineType, productId, stockItemId, simpleLotId, quantity,
    barcode: text(line.barcode, 180),
    productName: text(line.productName, 300) || `Product ${productId}`,
    modelName: text(line.model || line.modelName, 200),
    unitPrice: money(line.unitPrice ?? line.price, `items[${index}].unitPrice`),
    discount: money(line.discount || 0, `items[${index}].discount`),
    remark: text(line.remark, 500),
    sortOrder: index,
  };
};

const parseSnapshot = (body = {}) => {
  const items = (Array.isArray(body.items) ? body.items : []).map(parseLine);
  if (!items.length) fail('Held cart requires at least one item', 'HELD_CART_ITEMS_REQUIRED');
  if (new Set(items.map((item) => item.lineKey)).size !== items.length) fail('Held cart line keys must be unique', 'HELD_CART_DUPLICATE_LINE');
  const totalBeforeDiscount = money(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), 'totalBeforeDiscount');
  const totalDiscount = money(items.reduce((sum, item) => sum + item.discount, 0), 'totalDiscount');
  if (totalDiscount > totalBeforeDiscount + 0.01) fail('Discount exceeds cart total', 'HELD_CART_TOTAL_INVALID');
  return {
    customerId: body.customerId == null ? null : positiveInt(body.customerId, 'customerId'),
    customerName: text(body.customerName, 200),
    customerPhone: text(body.customerPhone, 60),
    note: text(body.note, 1000),
    priceType: ['retail', 'technician', 'wholesale'].includes(body.priceType) ? body.priceType : 'retail',
    items,
    totalBeforeDiscount,
    totalDiscount,
    totalAmount: money(totalBeforeDiscount - totalDiscount, 'totalAmount'),
  };
};

module.exports = Object.freeze({ fail, money, parseSnapshot, positiveInt, text });
