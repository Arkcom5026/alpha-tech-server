'use strict';

const repository = require('./productReservationDeliveryStatusRepository');

const TARGET_STATUSES = Object.freeze(['READY_TO_SHIP', 'SHIPPING', 'DELIVERED']);

const fail = (statusCode, code, message) => {
  throw Object.assign(new Error(message), { statusCode, code });
};

const positiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(400, 'RESERVATION_INPUT_INVALID', `${fieldName} must be a positive integer`);
  }
  return parsed;
};

const transitionProductReservationDeliveryStatus = async (authority = {}) => {
  const targetStatus = String(authority.targetStatus || '').trim().toUpperCase();
  if (!TARGET_STATUSES.includes(targetStatus)) {
    fail(400, 'RESERVATION_DELIVERY_STATUS_INVALID', 'Invalid delivery target status');
  }

  return repository.transitionDeliveryStatus({
    id: positiveInt(authority.reservationId, 'reservationId'),
    branchId: positiveInt(authority.branchId, 'branchId'),
    targetStatus,
  });
};

module.exports = Object.freeze({ TARGET_STATUSES, transitionProductReservationDeliveryStatus });
