'use strict';

const repository = require('./productReservationExpiryRepository');

const fail = (statusCode, code, message, details) => {
  throw Object.assign(new Error(message), { statusCode, code, details });
};

const positiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(400, 'RESERVATION_INPUT_INVALID', `${fieldName} must be a positive integer`, { fieldName });
  }
  return parsed;
};

const expireDueProductReservations = async (input = {}, authority = {}) => {
  const branchId = positiveInt(authority.branchId, 'branchId');
  const employeeId = positiveInt(authority.employeeId, 'employeeId');
  const requestedLimit = input.limit == null ? 50 : positiveInt(input.limit, 'limit');
  const limit = Math.min(requestedLimit, 100);
  const now = input.now ? new Date(input.now) : new Date();
  if (Number.isNaN(now.getTime())) fail(400, 'RESERVATION_DATE_INVALID', 'now is invalid');

  return repository.expireDue({ branchId, employeeId, limit, now });
};

module.exports = Object.freeze({ expireDueProductReservations });
