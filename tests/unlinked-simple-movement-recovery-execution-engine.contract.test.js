const assert = require('assert');
const {
  executeUnlinkedSimpleMovementRecovery,
} = require('../src/modules/inventory/recovery/unlinked-simple-movement/execution/executeUnlinkedSimpleMovementRecovery');

const recoveryBarcode = 'RCV-USMR-2-100-1234567890abcdef1234';
const executionPlan = {
  mode: 'PLAN_ONLY',
  branchId: 2,
  manifestId: 'usmr-2-manifest',
  sourceSnapshotHash: 'snapshot-hash',
  executionPlanId: 'usmr-plan-2-plan',
  executionPlanHash: 'plan-hash',
  operatorIdentity: 'employee:35',
  totals: {
    operationCount: 1,
    productCount: 1,
    totalQuantity: 5,
    totalInventoryValue: 100,
    movementLinkCount: 1,
  },
  operations: [{
    sequence: 1,
    operationType: 'CREATE_SIMPLE_LOT_AND_LINK_EXISTING_MOVEMENT',
    entryId: 'branch-2-balance-10',
    branchId: 2,
    stockBalanceId: 10,
    productId: 100,
    preconditionHash: 'precondition-hash',
    movementEvidenceHash: 'movement-evidence-hash',
    createLot: {
      barcode: recoveryBarcode,
      qtyInitial: 5,
      qtyRemaining: 5,
      unitCost: 20,
      costSource: 'STOCK_BALANCE_AVG_COST',
      status: 'ACTIVE',
    },
    linkExistingMovementIds: [1000],
    impact: {
      quantity: 5,
      unitCost: 20,
      inventoryValue: 100,
    },
  }],
  blockedEntries: [{
    entryId: 'branch-2-balance-11',
    classification: 'BLOCKED_MISSING_COST',
  }],
};

const approval = {
  explicitApproval: true,
  branchId: 2,
  manifestId: executionPlan.manifestId,
  sourceSnapshotHash: executionPlan.sourceSnapshotHash,
  executionPlanId: executionPlan.executionPlanId,
  executionPlanHash: executionPlan.executionPlanHash,
  operatorIdentity: executionPlan.operatorIdentity,
};

const buildRepository = ({
  manifestMatches = true,
  planMatches = true,
  operationMatches = true,
  linkCount = 1,
} = {}) => {
  const calls = [];
  const txRepository = {
    async revalidateExecutionPlan() {
      calls.push('revalidateExecutionPlan');
      return {
        manifestMatches,
        planMatches,
        operationResults: [{
          entryId: executionPlan.operations[0].entryId,
          matches: operationMatches,
        }],
      };
    },
    async createSimpleLot(data) {
      calls.push({ createSimpleLot: data });
      return { id: 9001, ...data };
    },
    async linkExistingMovements(data) {
      calls.push({ linkExistingMovements: data });
      return { count: linkCount };
    },
    async recordExecutionAudit(data) {
      calls.push({ recordExecutionAudit: data });
      return { auditType: 'UNLINKED_SIMPLE_MOVEMENT_RECOVERY_EXECUTION', ...data };
    },
  };

  return {
    calls,
    async transaction(work) {
      calls.push('transaction');
      return work(txRepository);
    },
  };
};

(async () => {
  const repository = buildRepository();
  const result = await executeUnlinkedSimpleMovementRecovery({
    executionPlan,
    approval,
    repository,
  });

  assert.strictEqual(result.result, 'UNLINKED_SIMPLE_MOVEMENT_RECOVERY_EXECUTED');
  assert.strictEqual(result.mutationPerformed, true);
  assert.strictEqual(result.operationResults.length, 1);
  assert.strictEqual(result.operationResults[0].simpleLotId, 9001);
  assert.strictEqual(result.operationResults[0].barcode, recoveryBarcode);
  assert.deepStrictEqual(result.operationResults[0].linkedMovementIds, [1000]);
  assert.strictEqual(repository.calls[0], 'transaction');
  assert.strictEqual(repository.calls[1], 'revalidateExecutionPlan');

  const createCall = repository.calls.find((call) => call.createSimpleLot);
  assert.deepStrictEqual(createCall.createSimpleLot, {
    branchId: 2,
    productId: 100,
    barcode: recoveryBarcode,
    qtyInitial: 5,
    qtyRemaining: 5,
    unitCost: 20,
    status: 'ACTIVE',
  });

  const linkCall = repository.calls.find((call) => call.linkExistingMovements);
  assert.deepStrictEqual(linkCall.linkExistingMovements, {
    movementIds: [1000],
    branchId: 2,
    productId: 100,
    simpleLotId: 9001,
  });

  const createdLots = repository.calls.filter((call) => call.createSimpleLot).length;
  const linkedMovementSets = repository.calls.filter(
    (call) => call.linkExistingMovements
  ).length;
  assert.strictEqual(createdLots, 1);
  assert.strictEqual(linkedMovementSets, 1);
  assert.ok(!repository.calls.some((call) => call.createStockMovement));
  assert.ok(!repository.calls.some((call) => call.updateStockBalance));

  await assert.rejects(
    () => executeUnlinkedSimpleMovementRecovery({
      executionPlan,
      approval: { ...approval, explicitApproval: false },
      repository: buildRepository(),
    }),
    (error) => error.code === 'UNLINKED_SIMPLE_MOVEMENT_EXPLICIT_APPROVAL_REQUIRED'
  );

  await assert.rejects(
    () => executeUnlinkedSimpleMovementRecovery({
      executionPlan,
      approval: { ...approval, executionPlanHash: 'wrong-hash' },
      repository: buildRepository(),
    }),
    (error) => error.code === 'UNLINKED_SIMPLE_MOVEMENT_EXECUTION_AUTHORITY_MISMATCH'
  );

  const missingBarcodeRepository = buildRepository();
  const missingBarcodePlan = {
    ...executionPlan,
    operations: [{
      ...executionPlan.operations[0],
      createLot: {
        ...executionPlan.operations[0].createLot,
        barcode: '',
      },
    }],
  };
  await assert.rejects(
    () => executeUnlinkedSimpleMovementRecovery({
      executionPlan: missingBarcodePlan,
      approval,
      repository: missingBarcodeRepository,
    }),
    (error) => (
      error.code === 'UNLINKED_SIMPLE_MOVEMENT_EXECUTION_APPROVAL_REQUIRED'
      && error.details?.field === 'createLot.barcode'
    )
  );
  assert.deepStrictEqual(missingBarcodeRepository.calls, []);

  await assert.rejects(
    () => executeUnlinkedSimpleMovementRecovery({
      executionPlan,
      approval,
      repository: buildRepository({ manifestMatches: false }),
    }),
    (error) => error.code === 'UNLINKED_SIMPLE_MOVEMENT_STALE_RUNTIME_AUTHORITY'
  );

  await assert.rejects(
    () => executeUnlinkedSimpleMovementRecovery({
      executionPlan,
      approval,
      repository: buildRepository({ operationMatches: false }),
    }),
    (error) => error.code === 'UNLINKED_SIMPLE_MOVEMENT_PRECONDITION_MISMATCH'
  );

  await assert.rejects(
    () => executeUnlinkedSimpleMovementRecovery({
      executionPlan,
      approval,
      repository: buildRepository({ linkCount: 0 }),
    }),
    (error) => error.code === 'UNLINKED_SIMPLE_MOVEMENT_LINK_COUNT_MISMATCH'
  );

  console.log('unlinked simple movement recovery execution engine contract: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
