'use strict';

const assert = require('node:assert/strict');
const {
  COMMAND_TYPES,
  normalizeLifecycleCommand,
  planLifecycleTransition,
} = require('../src/modules/sales/reservations/lifecycle/productReservationLifecycleCommands');
const {
  STATUSES,
} = require('../src/modules/sales/reservations/lifecycle/productReservationLifecycleContract');
const {
  createProductReservationLifecycleService,
} = require('../src/modules/sales/reservations/lifecycle/productReservationLifecycleService');

const accepted = planLifecycleTransition({
  currentStatus: STATUSES.ACTIVE,
  command: {
    reservationId: 10,
    branchId: 2,
    commandType: COMMAND_TYPES.ACCEPT,
    commandKey: 'accept-10',
    actorId: 7,
    occurredAt: '2026-07-29T12:00:00.000Z',
  },
});
assert.equal(accepted.toStatus, STATUSES.ACCEPTED);
assert.equal(accepted.releaseStock, false);

const cancelled = planLifecycleTransition({
  currentStatus: STATUSES.ACCEPTED,
  command: {
    reservationId: 10,
    branchId: 2,
    commandType: COMMAND_TYPES.CANCEL,
    commandKey: 'cancel-10',
    actorId: 7,
  },
});
assert.equal(cancelled.toStatus, STATUSES.CANCELLED);
assert.equal(cancelled.releaseStock, true);

assert.throws(
  () => normalizeLifecycleCommand({ reservationId: 10, branchId: 2, commandType: 'UNKNOWN', commandKey: 'x' }),
  (error) => error.code === 'PRODUCT_RESERVATION_COMMAND_UNKNOWN',
);

const repositoryCalls = [];
const service = createProductReservationLifecycleService({
  clock: () => new Date('2026-07-29T12:00:00.000Z'),
  repository: {
    async findCommandReplay() {
      repositoryCalls.push('findCommandReplay');
      return null;
    },
    async findForLifecycleCommand() {
      repositoryCalls.push('findForLifecycleCommand');
      return { id: 10, branchId: 2, status: STATUSES.ACTIVE, stockReleasedAt: null };
    },
    async executeLifecycleTransition({ transition }) {
      repositoryCalls.push('executeLifecycleTransition');
      return {
        reservation: { id: 10, branchId: 2, status: transition.toStatus },
        stockReleased: transition.releaseStock,
      };
    },
  },
});

service.execute({
  reservationId: 10,
  branchId: 2,
  commandType: COMMAND_TYPES.EXPIRE,
  commandKey: 'expire-10',
}).then((result) => {
  assert.deepEqual(repositoryCalls, [
    'findCommandReplay',
    'findForLifecycleCommand',
    'executeLifecycleTransition',
  ]);
  assert.equal(result.replayed, false);
  assert.equal(result.reservation.status, STATUSES.EXPIRED);
  assert.equal(result.stockReleased, true);
  console.log('ProductReservation lifecycle runtime contract: PASS');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
