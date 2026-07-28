'use strict';

const repository = require('./productReservationCreateRepository');
const { evaluateStorefrontCheckout } = require('../../storefront/checkout/storefrontCheckoutEligibilityService');

const ORDER_SOURCES = Object.freeze(['MARKETPLACE', 'STOREFRONT', 'FACEBOOK', 'LINE', 'QR', 'PHONE', 'OTHER']);
const FULFILLMENT_METHODS = Object.freeze(['PICKUP', 'DELIVERY']);
const DELIVERY_FEE_MODES = Object.freeze(['FREE', 'FIXED', 'NEGOTIATED']);

const fail = (statusCode, code, message, details) => {
  throw Object.assign(new Error(message), { statusCode, code, details });
};

const positiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(400, 'RESERVATION_INPUT_INVALID', `${fieldName} must be a positive integer`, { fieldName });
  return parsed;
};

const money = (value, fieldName) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) fail(400, 'RESERVATION_INPUT_INVALID', `${fieldName} must be zero or greater`, { fieldName });
  return Number(parsed.toFixed(2));
};

const requiredText = (value, fieldName) => {
  const normalized = String(value || '').trim();
  if (!normalized) fail(400, 'RESERVATION_INPUT_INVALID', `${fieldName} is required`, { fieldName });
  return normalized;
};

const optionalText = (value) => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const enumValue = (value, allowed, fieldName, fallback) => {
  const normalized = String(value || fallback || '').trim().toUpperCase();
  if (!allowed.includes(normalized)) {
    fail(400, 'RESERVATION_INPUT_INVALID', `${fieldName} is invalid`, { fieldName, value: normalized, allowed });
  }
  return normalized;
};

const dateOrNull = (value, fieldName) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) fail(400, 'RESERVATION_DATE_INVALID', `${fieldName} is invalid`, { fieldName });
  return parsed;
};

const normalizeLine = (line, index) => {
  const lineType = String(line?.lineType || '').trim().toUpperCase();
  if (!['STOCK_ITEM', 'SIMPLE'].includes(lineType)) fail(400, 'RESERVATION_LINE_TYPE_INVALID', 'lineType must be STOCK_ITEM or SIMPLE', { index });
  const quantity = lineType === 'STOCK_ITEM' ? 1 : Number(line?.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) fail(400, 'RESERVATION_QUANTITY_INVALID', 'quantity must be greater than zero', { index });
  const normalized = {
    lineId: String(line?.lineId || `${lineType}-${index + 1}`).trim(),
    lineType,
    productId: positiveInt(line?.productId, `items[${index}].productId`),
    stockItemId: lineType === 'STOCK_ITEM' ? positiveInt(line?.stockItemId, `items[${index}].stockItemId`) : null,
    simpleLotId: lineType === 'SIMPLE' && line?.simpleLotId ? positiveInt(line.simpleLotId, `items[${index}].simpleLotId`) : null,
    quantity: Number(quantity.toFixed(2)),
    basePrice: money(line?.basePrice, `items[${index}].basePrice`),
    discount: money(line?.discount, `items[${index}].discount`),
    price: money(line?.price, `items[${index}].price`),
    vatAmount: money(line?.vatAmount, `items[${index}].vatAmount`),
    remark: optionalText(line?.remark),
  };
  if (!normalized.lineId) fail(400, 'RESERVATION_LINE_ID_REQUIRED', 'lineId is required', { index });
  return normalized;
};

const normalizeFulfillment = (input) => {
  const fulfillmentMethod = enumValue(input.fulfillmentMethod, FULFILLMENT_METHODS, 'fulfillmentMethod', 'PICKUP');

  if (fulfillmentMethod === 'PICKUP') {
    return {
      fulfillmentMethod,
      deliveryFeeMode: null,
      deliveryFee: 0,
      recipientName: null,
      recipientPhone: null,
      deliveryAddress: null,
      deliveryNote: null,
    };
  }

  const deliveryFeeMode = enumValue(input.deliveryFeeMode, DELIVERY_FEE_MODES, 'deliveryFeeMode');
  const deliveryFee = money(input.deliveryFee, 'deliveryFee');
  if (deliveryFeeMode === 'FREE' && deliveryFee !== 0) {
    fail(400, 'RESERVATION_DELIVERY_FEE_INVALID', 'deliveryFee must be zero when deliveryFeeMode is FREE');
  }
  if (deliveryFeeMode === 'FIXED' && deliveryFee <= 0) {
    fail(400, 'RESERVATION_DELIVERY_FEE_INVALID', 'deliveryFee must be greater than zero when deliveryFeeMode is FIXED');
  }

  return {
    fulfillmentMethod,
    deliveryFeeMode,
    deliveryFee,
    recipientName: requiredText(input.recipientName, 'recipientName'),
    recipientPhone: requiredText(input.recipientPhone, 'recipientPhone'),
    deliveryAddress: requiredText(input.deliveryAddress, 'deliveryAddress'),
    deliveryNote: optionalText(input.deliveryNote),
  };
};

const createProductReservation = async (input = {}, authority = {}) => {
  const branchId = positiveInt(authority.branchId, 'branchId');
  const employeeId = positiveInt(authority.employeeId, 'employeeId');
  const customerId = positiveInt(input.customerId, 'customerId');
  const items = Array.isArray(input.items) ? input.items.map(normalizeLine) : [];
  if (!items.length) fail(400, 'RESERVATION_ITEMS_REQUIRED', 'At least one reservation item is required');

  const duplicateLineIds = items.filter((line, index) => items.findIndex((other) => other.lineId === line.lineId) !== index).map((line) => line.lineId);
  const duplicateStockIds = items.filter((line) => line.stockItemId).filter((line, index, list) => list.findIndex((other) => other.stockItemId === line.stockItemId) !== index).map((line) => line.stockItemId);
  if (duplicateLineIds.length || duplicateStockIds.length) fail(400, 'RESERVATION_DUPLICATE_LINE', 'Duplicate reservation lines are not allowed', { duplicateLineIds, duplicateStockIds });

  const pickupAt = dateOrNull(input.pickupAt, 'pickupAt');
  const expiresAt = dateOrNull(input.expiresAt, 'expiresAt');
  if (pickupAt && expiresAt && expiresAt < pickupAt) fail(400, 'RESERVATION_EXPIRY_INVALID', 'expiresAt cannot be earlier than pickupAt');

  const orderSource = enumValue(input.orderSource, ORDER_SOURCES, 'orderSource', 'STOREFRONT');
  const fulfillmentMethod = enumValue(input.fulfillmentMethod, FULFILLMENT_METHODS, 'fulfillmentMethod', 'PICKUP');
  const checkoutAgreement = await evaluateStorefrontCheckout({
    branchId,
    orderSource,
    fulfillmentMethod,
    storefrontSlug: input.storefrontSlug,
    destinationAreas: input.destinationAreas,
    deliveryDistanceKm: input.deliveryDistanceKm,
  });
  const fulfillment = normalizeFulfillment(checkoutAgreement ? {
    ...input,
    fulfillmentMethod,
    deliveryFeeMode: checkoutAgreement.deliveryFeeMode,
    deliveryFee: checkoutAgreement.deliveryFee,
  } : input);
  if (fulfillment.fulfillmentMethod === 'DELIVERY' && pickupAt) {
    fail(400, 'RESERVATION_PICKUP_DATE_INVALID', 'pickupAt is not allowed for DELIVERY fulfillment');
  }

  return repository.create({
    branchId,
    employeeId,
    customerId,
    code: `RS-${branchId}-${Date.now()}-${String(authority.commandId || 'NEW').slice(-8)}`,
    orderSource,
    sourceReference: optionalText(input.sourceReference),
    ...fulfillment,
    totalBeforeDiscount: money(input.totalBeforeDiscount, 'totalBeforeDiscount'),
    totalDiscount: money(input.totalDiscount, 'totalDiscount'),
    totalAmount: money(input.totalAmount, 'totalAmount'),
    note: optionalText(input.note),
    pickupAt,
    expiresAt,
    items,
  });
};

module.exports = Object.freeze({
  ORDER_SOURCES,
  FULFILLMENT_METHODS,
  DELIVERY_FEE_MODES,
  createProductReservation,
});
