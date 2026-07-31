const assert = require('assert');
const {
  executeSimpleStockBackfill,
} = require('../src/modules/inventory/recovery/simple-stock-backfill/execution/executeSimpleStockBackfill');

const buildPlan = () => ({
  executionPlanId: 'ssb-plan-2-example',
  executionPlanHash: 'plan-hash-example',
  branchId: 2,
  operatorIdentity: 'employee:35',
  sourceApproval: {
    manifestId: 'ssb-2-example',
    sourceSnapshotHash: 'snapshot-hash-example',
  },
  mode: 'PLAN_ONLY',
  mutationPerformed: false,
  executable: false,
  approvedForMutation: false,
  operations: [
    {
      sequence: 1,
      entryId: 'branch-2-balance-10',
      branchId: 2,
      productId: 1001,
      preconditionHash: 'precondition-10',
      actions: [
        {
          action: 'CREATE_SIMPLE_LOT',
          payload: {
            branchId: 2,
            productId: 1001,
            qtyInitial: 5,
            qtyRemaining: 5,
            unitCost: 120,
            status: 'ACTIVE',
            source: 'LEGACY_BACKFILL_EXECUTION_PLAN',
          },
        },
        {
          action: 'CREATE_STOCK_MOVEMENT',
          payload: {
            branchId: 2,
            productId: 1001,
            qty: 5,
            type: 'LEGACY_BACKFILL',
            refType: 'SIMPLE_STOCK_BACKFILL',
            note: 'Planned legacy backfill for branch-2-balance-10',
          },
        },
      ],
      impact: {
        quantity: 5,
        unitCost: 120,
        inventoryValue: 600,
      },
    },
  ],
  blockedEntries: [
    {
      entryId: 'branch-2-balance-11',
      productId: 1002,
      classification: 'BLOCKED_MISSING_COST',
      reasonCode: 'LEGACY_BALANCE_WITHOUT_DEFENSIBLE_COST',
      preconditionHash: 'precondition-11',
    },
  ],
  executionGuards: {
    revalidateManifestBeforeExecution: true,
    revalidateEveryPreconditionHash: true,
    abortOnAnyDrift: true,
    transactionRequired: true,
    partialCommitAllowed: false,
    executionRequiresSeparateApprovedIncrement: true,
  },
});

class FakeRepository {
  constructor({ drift = false, failMovement = false } = {}) {
    this.drift = drift;
    this.failMovement = failMovement;
    this.events = [];
  }

  async transaction(work) {
    this.events.push('transaction:start');
    const snapshot = this.events.slice();
    try {
      const result = await work(this);
      this.events.push('transaction:commit');
      return result;
    } catch (error) {
      this.events = snapshot;
      this.events.push('transaction:rollback');
      throw error;
    }
  }

  async revalidateExecutionPlan({ executionPlan }) {
    this.events.push('revalidate:manifest');
    return {
      manifestMatches: !this.drift,
      planMatches: !this.drift,
      operationResults: executionPlan.operations.map((operation) => ({
        entryId: operation.entryId,
        productId: operation.productId,
        preconditionHash: operation.preconditionHash,
        matches: !this.drift,
      })),
    };
  }

  async createSimpleLot(data) {
    this.events.push(`lot:${data.productId}`);
    return { id: 501, ...data };
  }

  async createStockMovement(data) {
    if (this.failMovement) {
      throw new Error('simulated movement failure');
    }
    this.events.push(`movement:${data.productId}`);
    return { id: 701, ...data };
  }

  async recordExecutionAudit(data) {
    this.events.push('audit');
    return { id: 'audit-1', ...data };
  }
}

const approval = () => ({
  executionPlanId: 'ssb-plan-2-example',
  executionPlanHash: 'plan-hash-example',
  manifestId: 'ssb-2-example',
  sourceSnapshotHash: 'snapshot-hash-example',
  operatorIdentity: 'employee:35',
  explicitApproval: true,
});

const run = async () => {
  await assert.rejects(
    () => executeSimpleStockBackfill({
      executionPlan: buildPlan(),
      approval: { ...approval(), explicitApproval: false },
      repository: new FakeRepository(),
    }),
    (error) => error.code === 'SIMPLE_STOCK_BACKFILL_EXPLICIT_APPROVAL_REQUIRED'
  );

  await assert.rejects(
    () => executeSimpleStockBackfill({
      executionPlan: buildPlan(),
      approval: { ...approval(), executionPlanHash: 'wrong-hash' },
      repository: new FakeRepository(),
    }),
    (error) => error.code === 'SIMPLE_STOCK_BACKFILL_EXECUTION_PLAN_APPROVAL_MISMATCH'
  );

  const driftRepository = new FakeRepository({ drift: true });
  await assert.rejects(
    () => executeSimpleStockBackfill({
      executionPlan: buildPlan(),
      approval: approval(),
      repository: driftRepository,
    }),
    (error) => error.code === 'SIMPLE_STOCK_BACKFILL_PRECONDITION_DRIFT'
  );
  assert.deepStrictEqual(driftRepository.events, [
    'transaction:start',
    'revalidate:manifest',
    'transaction:rollback',
  ]);

  const rollbackRepository = new FakeRepository({ failMovement: true });
  await assert.rejects(
    () => executeSimpleStockBackfill({
      executionPlan: buildPlan(),
      approval: approval(),
      repository: rollbackRepository,
    }),
    /simulated movement failure/
  );
  assert.deepStrictEqual(rollbackRepository.events, [
    'transaction:start',
    'transaction:rollback',
  ]);

  const repository = new FakeRepository();
  const result = await executeSimpleStockBackfill({
    executionPlan: buildPlan(),
    approval: approval(),
    repository,
  });

  assert.strictEqual(result.mode, 'EXECUTED');
  assert.strictEqual(result.mutationPerformed, true);
  assert.strictEqual(result.branchId, 2);
  assert.strictEqual(result.executedEntryCount, 1);
  assert.strictEqual(result.createdLotCount, 1);
  assert.strictEqual(result.createdMovementCount, 1);
  assert.strictEqual(result.skippedBlockedEntryCount, 1);
  assert.strictEqual(result.totalQuantity, 5);
  assert.strictEqual(result.totalInventoryValue, 600);
  assert.deepStrictEqual(repository.events, [
    'transaction:start',
    'revalidate:manifest',
    'lot:1001',
    'movement:1001',
    'audit',
    'transaction:commit',
  ]);
  assert.strictEqual(repository.events.includes('lot:1002'), false);
  assert.strictEqual(repository.events.includes('movement:1002'), false);

  console.log('simple stock backfill execution engine contract: PASS');
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
