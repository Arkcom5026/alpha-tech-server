'use strict';

const repository = require('./productReservationQueryRepository');

const STATUSES = Object.freeze(['ACTIVE', 'PARTIALLY_PAID', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'EXPIRED']);

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

const listProductReservations = (input = {}) => {
  const status = String(input.status || '').trim().toUpperCase();
  if (status && !STATUSES.includes(status)) {
    throw Object.assign(new Error('Invalid reservation status'), {
      statusCode: 400,
      code: 'RESERVATION_STATUS_INVALID',
      details: { status },
    });
  }
  return repository.list({
    branchId: positiveInt(input.branchId, 'branchId'),
    customerId: positiveInt(input.customerId, 'customerId', false),
    status: status || null,
    keyword: String(input.keyword || '').trim(),
    limit: Math.min(Math.max(Number(input.limit) || 50, 1), 200),
    offset: Math.max(Number(input.offset) || 0, 0),
  });
};

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

module.exports = Object.freeze({ STATUSES, listProductReservations, getProductReservationById });
