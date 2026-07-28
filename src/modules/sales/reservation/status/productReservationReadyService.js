'use strict';

const repository = require('./productReservationReadyRepository');

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

const markProductReservationReady = async (authority = {}) => repository.markReady({
  id: positiveInt(authority.reservationId, 'reservationId'),
  branchId: positiveInt(authority.branchId, 'branchId'),
});

module.exports = Object.freeze({ markProductReservationReady });
