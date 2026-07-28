'use strict';

const repository = require('./productReservationCancelRepository');

const positiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), {
      statusCode: 400,
      code: 'RESERVATION_CANCEL_INPUT_INVALID',
      details: { fieldName },
    });
  }
  return parsed;
};

const cancelProductReservation = (input = {}, authority = {}) => repository.cancel({
  id: positiveInt(input.id, 'id'),
  branchId: positiveInt(authority.branchId, 'branchId'),
  employeeId: positiveInt(authority.employeeId, 'employeeId'),
  reason: input.reason ? String(input.reason).trim().slice(0, 500) : null,
});

module.exports = Object.freeze({ cancelProductReservation });
