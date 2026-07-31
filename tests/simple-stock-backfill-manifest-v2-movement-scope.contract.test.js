const assert = require('assert');
const {
  MANIFEST_VERSION,
  buildSimpleStockBackfillManifest,
} = require('../src/modules/inventory/recovery/simple-stock-backfill/manifest/simpleStockBackfillManifest');
const {
  validateSimpleStockBackfillApprovalDryRun,
} = require('../src/modules/inventory/recovery/simple-stock-backfill/approval/validateSimpleStockBackfillApprovalDryRun');

const branchId = 2;
const balances = [{
  id: 6359,
  branchId,
  productId: 3366,
  quantity: 4,
  reserved: 0,
  avgCost: 2970,
  lastReceivedCost: 2970,
}];

const emptyLots = [];

const cleanManifest = buildSimpleStockBackfillManifest({
  branchId,
  balances,
  lots: emptyLots,
  movements: [],
});

assert.strictEqual(MANIFEST_VERSION, 'simple-stock-backfill-manifest-v2');
assert.strictEqual(cleanManifest.entries[0].classification, 'READY_FOR_APPROVAL');
assert.deepStrictEqual(cleanManifest.entries[0].preconditions, {
  branchId,
  stockBalanceId: 6359,
  productId: 3366,
  quantity: 4,
  reserved: 0,
  avgCost: 2970,
  lastReceivedCost: 2970,
  lotCount: 0,
  allMovementCount: 0,
  linkedMovementCount: 0,
  unlinkedMovementCount: 0,
});

const unlinkedManifest = buildSimpleStockBackfillManifest({
  branchId,
  balances,
  lots: emptyLots,
  movements: [{
    id: 1001,
    branchId,
    productId: 3366,
    simpleLotId: null,
  }],
});

const unlinkedEntry = unlinkedManifest.entries[0];
assert.strictEqual(unlinkedEntry.classification, 'MANUAL_REVIEW');
assert.strictEqual(
  unlinkedEntry.reasonCode,
  'LEGACY_BALANCE_HAS_UNLINKED_STOCK_MOVEMENT_HISTORY'
);
assert.strictEqual(unlinkedEntry.proposedLot, null);
assert.strictEqual(unlinkedEntry.preconditions.allMovementCount, 1);
assert.strictEqual(unlinkedEntry.preconditions.linkedMovementCount, 0);
assert.strictEqual(unlinkedEntry.preconditions.unlinkedMovementCount, 1);
assert.notStrictEqual(unlinkedEntry.preconditionHash, cleanManifest.entries[0].preconditionHash);
assert.notStrictEqual(unlinkedManifest.sourceSnapshotHash, cleanManifest.sourceSnapshotHash);
assert.notStrictEqual(unlinkedManifest.manifestId, cleanManifest.manifestId);

const linkedManifest = buildSimpleStockBackfillManifest({
  branchId,
  balances,
  lots: emptyLots,
  movements: [{
    id: 1002,
    branchId,
    productId: 3366,
    simpleLotId: 55,
  }],
});

const linkedEntry = linkedManifest.entries[0];
assert.strictEqual(linkedEntry.classification, 'MANUAL_REVIEW');
assert.strictEqual(
  linkedEntry.reasonCode,
  'LEGACY_BALANCE_HAS_STOCK_MOVEMENT_HISTORY'
);
assert.strictEqual(linkedEntry.preconditions.allMovementCount, 1);
assert.strictEqual(linkedEntry.preconditions.linkedMovementCount, 1);
assert.strictEqual(linkedEntry.preconditions.unlinkedMovementCount, 0);

const staleResult = validateSimpleStockBackfillApprovalDryRun({
  branchId,
  manifestId: cleanManifest.manifestId,
  sourceSnapshotHash: cleanManifest.sourceSnapshotHash,
  operatorIdentity: 'employee:35',
  balances,
  lots: emptyLots,
  movements: [{
    id: 1001,
    branchId,
    productId: 3366,
    simpleLotId: null,
  }],
});

assert.strictEqual(staleResult.validation.stale, true);
assert.strictEqual(staleResult.validation.result, 'REJECTED_STALE_DATA');
assert.strictEqual(staleResult.validation.readyEntryCount, 0);
assert.strictEqual(staleResult.validation.blockedEntryCount, 1);
assert.strictEqual(staleResult.blockedEntries[0].classification, 'MANUAL_REVIEW');
assert.ok(
  staleResult.validation.staleReasons.some(
    (reason) => reason.code === 'MANIFEST_ID_MISMATCH'
  )
);
assert.ok(
  staleResult.validation.staleReasons.some(
    (reason) => reason.code === 'SOURCE_SNAPSHOT_HASH_MISMATCH'
  )
);

console.log('simple stock backfill manifest v2 movement scope contract: PASS');
