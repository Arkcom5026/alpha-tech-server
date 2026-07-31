const assert = require('assert');
const {
  buildUnlinkedSimpleMovementRecoveryManifest,
} = require('../src/modules/inventory/recovery/unlinked-simple-movement/manifest/buildUnlinkedSimpleMovementRecoveryManifest');
const {
  validateUnlinkedSimpleMovementRecoveryApprovalDryRun,
} = require('../src/modules/inventory/recovery/unlinked-simple-movement/approval/validateUnlinkedSimpleMovementRecoveryApprovalDryRun');
const {
  PLAN_VERSION,
  buildUnlinkedSimpleMovementRecoveryExecutionPlan,
} = require('../src/modules/inventory/recovery/unlinked-simple-movement/execution-plan/buildUnlinkedSimpleMovementRecoveryExecutionPlan');

const branchId = 2;
const balances = [
  {
    id: 10,
    branchId,
    productId: 100,
    quantity: 5,
    reserved: 0,
    avgCost: 20,
    lastReceivedCost: 20,
  },
  {
    id: 11,
    branchId,
    productId: 101,
    quantity: 3,
    reserved: 0,
    avgCost: 0,
    lastReceivedCost: 0,
  },
];
const lots = [];
const movements = [
  {
    id: 1000,
    branchId,
    productId: 100,
    qty: 5,
    type: 'RECEIVE',
    refType: 'LEGACY_RECEIPT',
    refId: 77,
    simpleLotId: null,
    performedByEmployeeId: 35,
    occurredAt: '2025-01-01T00:00:00.000Z',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

const manifest = buildUnlinkedSimpleMovementRecoveryManifest({
  branchId,
  balances,
  lots,
  movements,
});

const dryRun = validateUnlinkedSimpleMovementRecoveryApprovalDryRun({
  branchId,
  manifestId: manifest.manifestId,
  sourceSnapshotHash: manifest.sourceSnapshotHash,
  operatorIdentity: 'employee:35',
  balances,
  lots,
  movements,
});

assert.strictEqual(dryRun.validation.result, 'VALIDATED_DRY_RUN_ONLY');
assert.strictEqual(dryRun.validation.stale, false);
assert.strictEqual(dryRun.validation.readyEntryCount, 1);
assert.strictEqual(dryRun.validation.blockedEntryCount, 1);
assert.strictEqual(dryRun.mutationPerformed, false);

const firstPlan = buildUnlinkedSimpleMovementRecoveryExecutionPlan({ dryRunResult: dryRun });
const secondPlan = buildUnlinkedSimpleMovementRecoveryExecutionPlan({ dryRunResult: dryRun });

assert.strictEqual(PLAN_VERSION, 'unlinked-simple-movement-recovery-plan-v1');
assert.deepStrictEqual(firstPlan, secondPlan);
assert.strictEqual(firstPlan.mode, 'PLAN_ONLY');
assert.strictEqual(firstPlan.mutationPerformed, false);
assert.strictEqual(firstPlan.executable, false);
assert.strictEqual(firstPlan.approvedForMutation, false);
assert.strictEqual(firstPlan.totals.operationCount, 1);
assert.strictEqual(firstPlan.totals.productCount, 1);
assert.strictEqual(firstPlan.totals.totalQuantity, 5);
assert.strictEqual(firstPlan.totals.totalInventoryValue, 100);
assert.strictEqual(firstPlan.totals.movementLinkCount, 1);
assert.strictEqual(firstPlan.operations.length, 1);
assert.strictEqual(
  firstPlan.operations[0].operationType,
  'CREATE_SIMPLE_LOT_AND_LINK_EXISTING_MOVEMENT'
);
assert.deepStrictEqual(firstPlan.operations[0].linkExistingMovementIds, [1000]);
assert.strictEqual(firstPlan.operations[0].createLot.qtyInitial, 5);
assert.strictEqual(firstPlan.operations[0].createLot.qtyRemaining, 5);
assert.strictEqual(firstPlan.operations[0].createLot.unitCost, 20);
assert.strictEqual(firstPlan.blockedEntries.length, 1);
assert.strictEqual(
  firstPlan.blockedEntries[0].classification,
  'BLOCKED_MISSING_COST'
);
assert.strictEqual(firstPlan.approvalContract.mutationRequiresSeparateIncrement, true);

const staleDryRun = validateUnlinkedSimpleMovementRecoveryApprovalDryRun({
  branchId,
  manifestId: manifest.manifestId,
  sourceSnapshotHash: manifest.sourceSnapshotHash,
  operatorIdentity: 'employee:35',
  balances: [{ ...balances[0], quantity: 6 }, balances[1]],
  lots,
  movements,
});

assert.strictEqual(staleDryRun.validation.result, 'REJECTED_STALE_DATA');
assert.strictEqual(staleDryRun.validation.stale, true);
assert.throws(
  () => buildUnlinkedSimpleMovementRecoveryExecutionPlan({ dryRunResult: staleDryRun }),
  (error) => error.code === 'UNLINKED_SIMPLE_MOVEMENT_VALIDATED_DRY_RUN_REQUIRED'
);

console.log('unlinked simple movement recovery approval plan contract: PASS');
