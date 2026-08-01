const assert = require('assert');
const {
  buildUnlinkedSimpleMovementRecoveryManifest,
} = require('../src/modules/inventory/recovery/unlinked-simple-movement/manifest/buildUnlinkedSimpleMovementRecoveryManifest');
const {
  validateUnlinkedSimpleMovementRecoveryApprovalDryRun,
} = require('../src/modules/inventory/recovery/unlinked-simple-movement/approval/validateUnlinkedSimpleMovementRecoveryApprovalDryRun');
const {
  buildUnlinkedSimpleMovementRecoveryExecutionPlan,
} = require('../src/modules/inventory/recovery/unlinked-simple-movement/execution-plan/buildUnlinkedSimpleMovementRecoveryExecutionPlan');
const {
  UnlinkedSimpleMovementRecoveryExecutionRepository,
} = require('../src/modules/inventory/recovery/unlinked-simple-movement/execution/unlinkedSimpleMovementRecoveryExecutionRepository');

const branchId = 2;
const operatorIdentity = 'employee:35';
const balances = [{
  id: 10,
  branchId,
  productId: 100,
  quantity: 5,
  reserved: 0,
  avgCost: 20,
  lastReceivedCost: 20,
}];
const lots = [];
const movements = [{
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
}];

const manifest = buildUnlinkedSimpleMovementRecoveryManifest({
  branchId,
  balances,
  lots,
  movements,
});
const dryRunResult = validateUnlinkedSimpleMovementRecoveryApprovalDryRun({
  branchId,
  manifestId: manifest.manifestId,
  sourceSnapshotHash: manifest.sourceSnapshotHash,
  operatorIdentity,
  balances,
  lots,
  movements,
});
const executionPlan = buildUnlinkedSimpleMovementRecoveryExecutionPlan({
  dryRunResult,
});
const approval = {
  branchId,
  manifestId: manifest.manifestId,
  sourceSnapshotHash: manifest.sourceSnapshotHash,
  executionPlanId: executionPlan.executionPlanId,
  executionPlanHash: executionPlan.executionPlanHash,
  operatorIdentity,
};

const updateCalls = [];
const fakeClient = {
  stockBalance: {
    findMany: async () => balances,
  },
  simpleLot: {
    findMany: async () => lots,
    create: async ({ data }) => ({ id: 5000, ...data }),
  },
  stockMovement: {
    findMany: async () => movements,
    updateMany: async (args) => {
      updateCalls.push(args);
      return { count: args.where.id.in.length };
    },
  },
  $transaction: async (work) => work(fakeClient),
};

(async () => {
  const repository = new UnlinkedSimpleMovementRecoveryExecutionRepository(fakeClient);

  assert.strictEqual(typeof repository.revalidateExecutionPlan, 'function');
  assert.strictEqual(typeof repository.linkExistingMovements, 'function');
  assert.strictEqual(typeof repository.recordExecutionAudit, 'function');

  let transactionRepository = null;
  await repository.transaction(async (txRepository) => {
    transactionRepository = txRepository;
  });
  assert.ok(transactionRepository instanceof UnlinkedSimpleMovementRecoveryExecutionRepository);

  const revalidation = await repository.revalidateExecutionPlan({
    executionPlan,
    approval,
  });
  assert.strictEqual(revalidation.manifestMatches, true);
  assert.strictEqual(revalidation.planMatches, true);
  assert.strictEqual(revalidation.operationResults.length, 1);
  assert.strictEqual(revalidation.operationResults[0].matches, true);

  const linkResult = await repository.linkExistingMovements({
    movementIds: [1000],
    branchId,
    productId: 100,
    simpleLotId: 5000,
  });
  assert.strictEqual(linkResult.count, 1);
  assert.deepStrictEqual(updateCalls[0].where.id, { in: [1000] });
  assert.strictEqual(updateCalls[0].where.branchId, branchId);
  assert.strictEqual(updateCalls[0].where.productId, 100);
  assert.strictEqual(updateCalls[0].where.simpleLotId, null);
  assert.strictEqual(updateCalls[0].data.simpleLotId, 5000);

  const audit = await repository.recordExecutionAudit({
    branchId,
    executionPlanId: executionPlan.executionPlanId,
  });
  assert.strictEqual(
    audit.auditType,
    'UNLINKED_SIMPLE_MOVEMENT_RECOVERY_EXECUTION'
  );
  assert.strictEqual(audit.branchId, branchId);
  assert.strictEqual(audit.executionPlanId, executionPlan.executionPlanId);
  assert.ok(audit.recordedAt);

  console.log('unlinked simple movement recovery execution repository contract: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
