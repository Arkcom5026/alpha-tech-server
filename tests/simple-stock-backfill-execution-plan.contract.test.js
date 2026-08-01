const assert = require('assert');
const {
  buildSimpleStockBackfillExecutionPlan,
} = require('../src/modules/inventory/recovery/simple-stock-backfill/execution-plan/buildSimpleStockBackfillExecutionPlan');

const validDryRun = () => ({
  mode: 'DRY_RUN_ONLY',
  mutationPerformed: false,
  executable: false,
  approvedForMutation: false,
  operatorIdentity: 'employee:35',
  branchId: 2,
  submittedApproval: {
    manifestId: 'ssb-2-example',
    sourceSnapshotHash: 'snapshot-hash',
  },
  currentManifest: {
    manifestId: 'ssb-2-example',
    sourceSnapshotHash: 'snapshot-hash',
  },
  validation: {
    stale: false,
    result: 'VALIDATED_DRY_RUN_ONLY',
  },
  readyEntries: [
    {
      entryId: 'branch-2-balance-10',
      preconditionHash: 'precondition-10',
      proposedLot: {
        qtyInitial: 5,
        qtyRemaining: 5,
        unitCost: 120,
        status: 'ACTIVE',
      },
    },
    {
      entryId: 'branch-2-balance-11',
      preconditionHash: 'precondition-11',
      proposedLot: {
        qtyInitial: 2,
        qtyRemaining: 2,
        unitCost: 250,
        status: 'ACTIVE',
      },
    },
  ],
  blockedEntries: [
    {
      entryId: 'branch-2-balance-12',
      classification: 'BLOCKED_MISSING_COST',
      reasonCode: 'LEGACY_BALANCE_WITHOUT_DEFENSIBLE_COST',
      preconditionHash: 'precondition-12',
    },
  ],
});

const run = () => {
  assert.throws(
    () => buildSimpleStockBackfillExecutionPlan({ dryRunResult: null }),
    (error) => error.code === 'SIMPLE_STOCK_BACKFILL_DRY_RUN_REQUIRED'
  );

  const stale = validDryRun();
  stale.validation.stale = true;
  stale.validation.result = 'REJECTED_STALE_DATA';
  assert.throws(
    () => buildSimpleStockBackfillExecutionPlan({ dryRunResult: stale }),
    (error) => error.code === 'SIMPLE_STOCK_BACKFILL_DRY_RUN_NOT_VALIDATED'
  );

  const first = buildSimpleStockBackfillExecutionPlan({ dryRunResult: validDryRun() });
  const second = buildSimpleStockBackfillExecutionPlan({ dryRunResult: validDryRun() });

  assert.strictEqual(first.executionPlanId, second.executionPlanId);
  assert.strictEqual(first.executionPlanHash, second.executionPlanHash);
  assert.strictEqual(first.mode, 'PLAN_ONLY');
  assert.strictEqual(first.mutationPerformed, false);
  assert.strictEqual(first.executable, false);
  assert.strictEqual(first.approvedForMutation, false);
  assert.strictEqual(first.branchId, 2);
  assert.strictEqual(first.operations.length, 2);
  assert.strictEqual(first.totals.readyEntryCount, 2);
  assert.strictEqual(first.totals.blockedEntryCount, 1);
  assert.strictEqual(first.totals.operationCount, 4);
  assert.strictEqual(first.totals.totalQuantity, 7);
  assert.strictEqual(first.totals.totalInventoryValue, 1100);
  assert.strictEqual(first.blockedEntries.length, 1);
  assert.strictEqual(first.operations[0].actions[0].action, 'CREATE_SIMPLE_LOT');
  assert.strictEqual(first.operations[0].actions[1].action, 'CREATE_STOCK_MOVEMENT');
  assert.strictEqual(first.operations[0].impact.inventoryValue, 600);
  assert.strictEqual(first.executionGuards.abortOnAnyDrift, true);
  assert.strictEqual(first.executionGuards.transactionRequired, true);
  assert.strictEqual(first.executionGuards.partialCommitAllowed, false);
  assert.strictEqual(first.executionGuards.executionRequiresSeparateApprovedIncrement, true);

  const changed = validDryRun();
  changed.readyEntries[0].proposedLot.qtyRemaining = 6;
  changed.readyEntries[0].proposedLot.qtyInitial = 6;
  const changedPlan = buildSimpleStockBackfillExecutionPlan({ dryRunResult: changed });
  assert.notStrictEqual(first.executionPlanId, changedPlan.executionPlanId);
  assert.notStrictEqual(first.executionPlanHash, changedPlan.executionPlanHash);

  const invalidReady = validDryRun();
  invalidReady.readyEntries[0].proposedLot.unitCost = 0;
  assert.throws(
    () => buildSimpleStockBackfillExecutionPlan({ dryRunResult: invalidReady }),
    (error) => error.code === 'SIMPLE_STOCK_BACKFILL_READY_ENTRY_INVALID'
  );

  console.log('simple stock backfill execution plan contract: PASS');
};

run();
