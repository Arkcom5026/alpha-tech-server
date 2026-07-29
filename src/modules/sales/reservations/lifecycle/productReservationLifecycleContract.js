'use strict';

const STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  ACCEPTED: 'ACCEPTED',
  FULFILLMENT_READY: 'FULFILLMENT_READY',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
});

const TERMINAL_STATUSES = new Set([
  STATUSES.CANCELLED,
  STATUSES.EXPIRED,
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  [STATUSES.ACTIVE]: new Set([
    STATUSES.ACCEPTED,
    STATUSES.CANCELLED,
    STATUSES.EXPIRED,
  ]),
  [STATUSES.ACCEPTED]: new Set([
    STATUSES.FULFILLMENT_READY,
    STATUSES.CANCELLED,
  ]),
  [STATUSES.FULFILLMENT_READY]: new Set(),
  [STATUSES.CANCELLED]: new Set(),
  [STATUSES.EXPIRED]: new Set(),
});

const canTransition = (fromStatus, toStatus) => Boolean(
  ALLOWED_TRANSITIONS[fromStatus]?.has(toStatus),
);

const assertTransition = (fromStatus, toStatus) => {
  if (!Object.values(STATUSES).includes(fromStatus)) {
    throw Object.assign(new Error('Unknown ProductReservation source status'), {
      code: 'PRODUCT_RESERVATION_STATUS_UNKNOWN',
      statusCode: 409,
      details: { fromStatus },
    });
  }

  if (!Object.values(STATUSES).includes(toStatus)) {
    throw Object.assign(new Error('Unknown ProductReservation target status'), {
      code: 'PRODUCT_RESERVATION_STATUS_UNKNOWN',
      statusCode: 409,
      details: { toStatus },
    });
  }

  if (!canTransition(fromStatus, toStatus)) {
    throw Object.assign(new Error('ProductReservation transition is not allowed'), {
      code: 'PRODUCT_RESERVATION_TRANSITION_NOT_ALLOWED',
      statusCode: 409,
      details: { fromStatus, toStatus },
    });
  }
};

const requiresStockRelease = (toStatus) => TERMINAL_STATUSES.has(toStatus);

module.exports = Object.freeze({
  STATUSES,
  TERMINAL_STATUSES,
  ALLOWED_TRANSITIONS,
  canTransition,
  assertTransition,
  requiresStockRelease,
});
