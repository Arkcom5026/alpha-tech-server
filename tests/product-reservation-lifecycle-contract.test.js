'use strict';

const {
  STATUSES,
  canTransition,
  requiresStockRelease,
} = require('../src/modules/sales/reservations/lifecycle/productReservationLifecycleContract');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(canTransition(STATUSES.ACTIVE, STATUSES.ACCEPTED), 'ACTIVE must allow merchant acceptance');
assert(canTransition(STATUSES.ACTIVE, STATUSES.CANCELLED), 'ACTIVE must allow cancellation');
assert(canTransition(STATUSES.ACTIVE, STATUSES.EXPIRED), 'ACTIVE must allow expiry');
assert(canTransition(STATUSES.ACCEPTED, STATUSES.FULFILLMENT_READY), 'ACCEPTED must allow fulfillment handoff');
assert(!canTransition(STATUSES.CANCELLED, STATUSES.ACTIVE), 'CANCELLED must be terminal');
assert(!canTransition(STATUSES.EXPIRED, STATUSES.ACTIVE), 'EXPIRED must be terminal');
assert(!canTransition(STATUSES.FULFILLMENT_READY, STATUSES.CANCELLED), 'FULFILLMENT_READY must not silently release stock');
assert(requiresStockRelease(STATUSES.CANCELLED), 'Cancellation must release stock');
assert(requiresStockRelease(STATUSES.EXPIRED), 'Expiry must release stock');
assert(!requiresStockRelease(STATUSES.ACCEPTED), 'Acceptance must preserve reservation stock');
assert(!requiresStockRelease(STATUSES.FULFILLMENT_READY), 'Fulfillment handoff must preserve reservation stock');

console.log('ProductReservation lifecycle contract: PASS');
