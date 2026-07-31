const assert = require('assert');
const {
  buildUnlinkedSimpleMovementRecoveryManifest,
} = require('../src/modules/inventory/recovery/unlinked-simple-movement/manifest/buildUnlinkedSimpleMovementRecoveryManifest');

const branchId = 2;
const balance = {
  id: 10,
  branchId,
  productId: 100,
  quantity: 5,
  reserved: 0,
  avgCost: 100,
  lastReceivedCost: 100,
};

const movement = (overrides = {}) => ({
  id: 1,
  branchId,
  productId: 100,
  qty: 5,
  type: 'IN',
  refType: 'LEGACY_RECEIPT',
  refId: 50,
  simpleLotId: null,
  performedByEmployeeId: 35,
  occurredAt: new Date('2026-01-01T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const build = ({
  balances = [balance],
  lots = [],
  movements = [movement()],
} = {}) => buildUnlinkedSimpleMovementRecoveryManifest({
  branchId,
  balances,
  lots,
  movements,
});

const safe = build();
assert.strictEqual(safe.mode, 'PREVIEW_ONLY');
assert.strictEqual(safe.mutationPerformed, false);
assert.strictEqual(safe.entries.length, 1);
assert.strictEqual(safe.entries[0].classification, 'SAFE_TO_LINK');
assert.strictEqual(safe.entries[0].proposedLot.qtyInitial, 5);
assert.strictEqual(safe.entries[0].proposedLot.qtyRemaining, 5);
assert.strictEqual(safe.entries[0].proposedLot.unitCost, 100);
assert.deepStrictEqual(safe.entries[0].movementIds, [1]);
assert.ok(safe.entries[0].movementEvidenceHash);
assert.ok(safe.entries[0].preconditionHash);
assert.ok(safe.sourceSnapshotHash);
assert.ok(safe.manifestId);

const mismatch = build({ movements: [movement({ qty: 4 })] });
assert.strictEqual(
  mismatch.entries[0].classification,
  'REQUIRES_MOVEMENT_RECONCILIATION'
);
assert.strictEqual(
  mismatch.entries[0].reasonCode,
  'MOVEMENT_NET_QUANTITY_DIFFERS_FROM_BALANCE'
);

const mixed = build({
  movements: [movement({ id: 1, qty: 6 }), movement({ id: 2, qty: -1 })],
});
assert.strictEqual(
  mixed.entries[0].classification,
  'REQUIRES_MOVEMENT_RECONCILIATION'
);
assert.strictEqual(mixed.entries[0].reasonCode, 'MOVEMENT_SET_HAS_MIXED_SIGNS');

const missingCost = build({
  balances: [{ ...balance, avgCost: 0, lastReceivedCost: 0 }],
});
assert.strictEqual(missingCost.entries[0].classification, 'BLOCKED_MISSING_COST');
assert.strictEqual(
  missingCost.entries[0].reasonCode,
  'NO_DEFENSIBLE_COST_FOR_RECOVERY_LOT'
);

const branchIsolation = build({
  movements: [
    movement(),
    movement({ id: 99, branchId: 3, qty: 999 }),
  ],
});
assert.strictEqual(branchIsolation.entries[0].movementIds.length, 1);
assert.deepStrictEqual(branchIsolation.entries[0].movementIds, [1]);

const deterministicA = build();
const deterministicB = build();
assert.strictEqual(deterministicA.manifestId, deterministicB.manifestId);
assert.strictEqual(
  deterministicA.sourceSnapshotHash,
  deterministicB.sourceSnapshotHash
);

console.log('unlinked simple movement recovery preview contract: PASS');
