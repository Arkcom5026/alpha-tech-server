'use strict';

const repository = require('./productReservationQueryRepository');
const { ORDER_SOURCES, FULFILLMENT_METHODS } = require('../create/productReservationCreateService');

const STATUSES = Object.freeze([
  'ACTIVE',
  'PARTIALLY_PAID',
  'READY_FOR_PICKUP',
  'READY_TO_SHIP',
  'SHIPPING',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
]);

const positiveInt = (value, fieldName, required = true) => {
  if ((value === undefined || value === null || value === '') && !required) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), {
      statusCode: 400,
      code: 'RESERVATION_QUERY_INVALID',
      details: { fieldName },
    });
  }
  return parsed;
};

const optionalEnum = (value, allowed, fieldName, code) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  if (!allowed.includes(normalized)) {
    throw Object.assign(new Error(`Invalid ${fieldName}`), {
      statusCode: 400,
      code,
      details: { [fieldName]: normalized, allowed },
    });
  }
  return normalized;
};

const listProductReservations = (input = {}) => repository.list({
  branchId: positiveInt(input.branchId, 'branchId'),
  customerId: positiveInt(input.customerId, 'customerId', false),
  status: optionalEnum(input.status, STATUSES, 'status', 'RESERVATION_STATUS_INVALID'),
  orderSource: optionalEnum(input.orderSource, ORDER_SOURCES, 'orderSource', 'RESERVATION_ORDER_SOURCE_INVALID'),
  fulfillmentMethod: optionalEnum(
    input.fulfillmentMethod,
    FULFILLMENT_METHODS,
    'fulfillmentMethod',
    'RESERVATION_FULFILLMENT_METHOD_INVALID'
  ),
  keyword: String(input.keyword || '').trim(),
  limit: Math.min(Math.max(Number(input.limit) || 50, 1), 200),
  offset: Math.max(Number(input.offset) || 0, 0),
});

const getProductReservationById = async (input = {}) => {
  const reservation = await repository.findById({
    id: positiveInt(input.id, 'id'),
    branchId: positiveInt(input.branchId, 'branchId'),
  });
  if (!reservation) {
    throw Object.assign(new Error('Product reservation was not found'), {
      statusCode: 404,
      code: 'RESERVATION_NOT_FOUND',
    });
  }
  return reservation;
};

module.exports = Object.freeze({
  STATUSES,
  ORDER_SOURCES,
  FULFILLMENT_METHODS,
  listProductReservations,
  getProductReservationById,
});
