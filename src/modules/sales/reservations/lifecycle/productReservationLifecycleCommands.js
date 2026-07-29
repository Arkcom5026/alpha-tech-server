'use strict';

const {
  STATUSES,
  assertTransition,
  requiresStockRelease,
} = require('./productReservationLifecycleContract');

const COMMAND_TYPES = Object.freeze({
  ACCEPT: 'ACCEPT',
  MARK_FULFILLMENT_READY: 'MARK_FULFILLMENT_READY',
  CANCEL: 'CANCEL',
  EXPIRE: 'EXPIRE',
});

const COMMAND_TARGET_STATUS = Object.freeze({
  [COMMAND_TYPES.ACCEPT]: STATUSES.ACCEPTED,
  [COMMAND_TYPES.MARK_FULFILLMENT_READY]: STATUSES.FULFILLMENT_READY,
  [COMMAND_TYPES.CANCEL]: STATUSES.CANCELLED,
  [COMMAND_TYPES.EXPIRE]: STATUSES.EXPIRED,
});

const fail = (code, message, details = null, statusCode = 400) => {
  throw Object.assign(new Error(message), { code, statusCode, details });
};

const normalizeLifecycleCommand = (input = {}) => {
  const reservationId = Number(input.reservationId);
  const branchId = Number(input.branchId);
  const commandType = String(input.commandType || '').trim().toUpperCase();
  const commandKey = String(input.commandKey || '').trim();
  const actorId = input.actorId == null ? null : Number(input.actorId);
  const reason = input.reason == null ? null : String(input.reason).trim() || null;
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    fail('PRODUCT_RESERVATION_ID_INVALID', 'ProductReservation id is invalid', { reservationId: input.reservationId });
  }
  if (!Number.isInteger(branchId) || branchId <= 0) {
    fail('PRODUCT_RESERVATION_BRANCH_INVALID', 'ProductReservation branch is invalid', { branchId: input.branchId });
  }
  if (!Object.values(COMMAND_TYPES).includes(commandType)) {
    fail('PRODUCT_RESERVATION_COMMAND_UNKNOWN', 'ProductReservation lifecycle command is unknown', { commandType: input.commandType });
  }
  if (!commandKey || commandKey.length > 200) {
    fail('PRODUCT_RESERVATION_COMMAND_KEY_INVALID', 'Lifecycle command key is required and must not exceed 200 characters');
  }
  if (actorId != null && (!Number.isInteger(actorId) || actorId <= 0)) {
    fail('PRODUCT_RESERVATION_ACTOR_INVALID', 'Lifecycle command actor is invalid', { actorId: input.actorId });
  }
  if (Number.isNaN(occurredAt.getTime())) {
    fail('PRODUCT_RESERVATION_OCCURRED_AT_INVALID', 'Lifecycle command occurredAt is invalid');
  }

  return Object.freeze({
    reservationId,
    branchId,
    commandType,
    commandKey,
    actorId,
    reason,
    occurredAt,
    targetStatus: COMMAND_TARGET_STATUS[commandType],
  });
};

const planLifecycleTransition = ({ currentStatus, command }) => {
  const normalizedCommand = normalizeLifecycleCommand(command);
  assertTransition(currentStatus, normalizedCommand.targetStatus);

  return Object.freeze({
    ...normalizedCommand,
    fromStatus: currentStatus,
    toStatus: normalizedCommand.targetStatus,
    releaseStock: requiresStockRelease(normalizedCommand.targetStatus),
  });
};

module.exports = Object.freeze({
  COMMAND_TYPES,
  COMMAND_TARGET_STATUS,
  normalizeLifecycleCommand,
  planLifecycleTransition,
});
