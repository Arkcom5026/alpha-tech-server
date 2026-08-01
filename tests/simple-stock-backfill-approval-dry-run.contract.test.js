const assert = require('assert');
const {
  buildSimpleStockBackfillManifest,
} = require('../src/modules/inventory/recovery/simple-stock-backfill/manifest/simpleStockBackfillManifest');
const {
  validateSimpleStockBackfillApprovalDryRun,
} = require('../src/modules/inventory/recovery/simple-stock-backfill/approval/validateSimpleStockBackfillApprovalDryRun');

const baseSnapshot = () => ({
  branchId: 2,
  balances: [
    {
      id: 10,
      branchId: 2,
      productId: 100,
      quantity: 5,
      reserved: 0,
      avgCost: 120,
      lastReceivedCost: 110,
    },
    {
      id: 11,
      branchId: 2,
      productId: 101,
      quantity: 3,
      reserved: 0,
      avgCost: 0,
      lastReceivedCost: 0,
    },
  ],
  lots: [],
  movements: [],
});

const run = () => {
  const snapshot = baseSnapshot();
  const manifest = buildSimpleStockBackfillManifest(snapshot);

  assert.throws(
    () => validateSimpleStockBackfillApprovalDryRun({
      ...snapshot,
      manifestId: '',
      sourceSnapshotHash: manifest.sourceSnapshotHash,
      operatorIdentity: 'employee:35',
    }),
    (error) => error.code === 'SIMPLE_STOCK_BACKFILL_MANIFEST_ID_REQUIRED'
  );

  assert.throws(
    () => validateSimpleStockBackfillApprovalDryRun({
      ...snapshot,
      manifestId: manifest.manifestId,
      sourceSnapshotHash: manifest.sourceSnapshotHash,
      operatorIdentity: '',
    }),
    (error) => error.code === 'SIMPLE_STOCK_BACKFILL_OPERATOR_REQUIRED'
  );

  const valid = validateSimpleStockBackfillApprovalDryRun({
    ...snapshot,
    manifestId: manifest.manifestId,
    sourceSnapshotHash: manifest.sourceSnapshotHash,
    operatorIdentity: 'employee:35',
  });

  assert.strictEqual(valid.mode, 'DRY_RUN_ONLY');
  assert.strictEqual(valid.mutationPerformed, false);
  assert.strictEqual(valid.executable, false);
  assert.strictEqual(valid.approvedForMutation, false);
  assert.strictEqual(valid.validation.stale, false);
  assert.strictEqual(valid.validation.result, 'VALIDATED_DRY_RUN_ONLY');
  assert.strictEqual(valid.validation.readyEntryCount, 1);
  assert.strictEqual(valid.validation.blockedEntryCount, 1);
  assert.strictEqual(valid.validation.allEntriesReady, false);
  assert.strictEqual(valid.safetyContract.noDatabaseMutation, true);
  assert.strictEqual(valid.safetyContract.executionRequiresSeparateApprovedIncrement, true);

  const changedSnapshot = baseSnapshot();
  changedSnapshot.balances[0].quantity = 6;
  const stale = validateSimpleStockBackfillApprovalDryRun({
    ...changedSnapshot,
    manifestId: manifest.manifestId,
    sourceSnapshotHash: manifest.sourceSnapshotHash,
    operatorIdentity: 'employee:35',
  });

  assert.strictEqual(stale.validation.stale, true);
  assert.strictEqual(stale.validation.result, 'REJECTED_STALE_DATA');
  assert.strictEqual(stale.executable, false);
  assert.strictEqual(stale.mutationPerformed, false);
  assert.ok(stale.validation.staleReasons.some((reason) => reason.code === 'MANIFEST_ID_MISMATCH'));
  assert.ok(stale.validation.staleReasons.some((reason) => reason.code === 'SOURCE_SNAPSHOT_HASH_MISMATCH'));

  console.log('simple stock backfill approval dry-run contract: PASS');
};

run();
