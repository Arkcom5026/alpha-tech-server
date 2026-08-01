const assert = require('assert');
const {
  buildSimpleStockBackfillManifest,
} = require('../src/modules/inventory/recovery/simple-stock-backfill/manifest/simpleStockBackfillManifest');

const baseInput = () => ({
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
    {
      id: 12,
      branchId: 3,
      productId: 999,
      quantity: 99,
      reserved: 0,
      avgCost: 1,
      lastReceivedCost: 1,
    },
  ],
  lots: [],
  movements: [],
});

const run = () => {
  assert.throws(
    () => buildSimpleStockBackfillManifest({ branchId: null, balances: [], lots: [], movements: [] }),
    (error) => error.code === 'INVENTORY_BRANCH_SCOPE_REQUIRED'
  );

  const first = buildSimpleStockBackfillManifest(baseInput());
  const reordered = baseInput();
  reordered.balances.reverse();
  const second = buildSimpleStockBackfillManifest(reordered);

  assert.strictEqual(first.manifestId, second.manifestId);
  assert.strictEqual(first.sourceSnapshotHash, second.sourceSnapshotHash);
  assert.deepStrictEqual(first.entries, second.entries);
  assert.strictEqual(first.branchId, 2);
  assert.strictEqual(first.mode, 'PREVIEW_ONLY');
  assert.strictEqual(first.mutationPerformed, false);
  assert.strictEqual(first.approvalContract.executable, false);
  assert.strictEqual(first.entries.length, 2, 'cross-branch balance must be excluded');

  const ready = first.entries.find((entry) => entry.preconditions.productId === 100);
  assert.strictEqual(ready.classification, 'READY_FOR_APPROVAL');
  assert.strictEqual(ready.proposedLot.qtyInitial, 5);
  assert.strictEqual(ready.proposedLot.qtyRemaining, 5);
  assert.strictEqual(ready.proposedLot.unitCost, 120);
  assert.strictEqual(ready.proposedLot.costSource, 'STOCK_BALANCE_AVG_COST');

  const blocked = first.entries.find((entry) => entry.preconditions.productId === 101);
  assert.strictEqual(blocked.classification, 'BLOCKED_MISSING_COST');
  assert.strictEqual(blocked.proposedLot, null);

  const mixedInput = baseInput();
  mixedInput.lots.push({ id: 50, branchId: 2, productId: 100 });
  const mixed = buildSimpleStockBackfillManifest(mixedInput);
  const manual = mixed.entries.find((entry) => entry.preconditions.productId === 100);
  assert.strictEqual(manual.classification, 'MANUAL_REVIEW');
  assert.strictEqual(manual.preconditions.lotCount, 1);

  const changedInput = baseInput();
  changedInput.balances[0].quantity = 6;
  const changed = buildSimpleStockBackfillManifest(changedInput);
  assert.notStrictEqual(first.sourceSnapshotHash, changed.sourceSnapshotHash);
  assert.notStrictEqual(first.manifestId, changed.manifestId);
  assert.notStrictEqual(
    ready.preconditionHash,
    changed.entries.find((entry) => entry.preconditions.productId === 100).preconditionHash
  );

  console.log('simple stock backfill manifest contract: PASS');
};

run();
