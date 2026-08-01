const assert = require('node:assert/strict');
const {
  MissingCostResolutionRecoveryExecutionRepository,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/recovery-execution/repository/missingCostResolutionRecoveryExecutionRepository');

(async () => {
  const calls = [];
  const tx = {
    missingCostResolutionEvent: {
      findFirst: async (args) => {
        calls.push(['missingCostResolutionEvent.findFirst', args]);
        return null;
      },
      create: async (args) => {
        calls.push(['missingCostResolutionEvent.create', args]);
        return { id: 501, ...args.data };
      },
    },
    missingCostResolution: {
      findFirst: async (args) => {
        calls.push(['missingCostResolution.findFirst', args]);
        return {
          id: 77,
          branchId: 3,
          stockBalanceId: 19,
          productId: 8,
          status: 'APPROVED',
          currentVersion: 4,
          sourceSnapshotHash: 'snapshot-4',
          versions: [{ id: 90, version: 4, evidenceHash: 'evidence-4', approvedAt: new Date() }],
        };
      },
    },
    stockBalance: {
      findFirst: async (args) => {
        calls.push(['stockBalance.findFirst', args]);
        return {
          id: 19,
          branchId: 3,
          productId: 8,
          quantity: 6,
          avgCost: null,
          lastReceivedCost: null,
        };
      },
      updateMany: async (args) => {
        calls.push(['stockBalance.updateMany', args]);
        return { count: 1 };
      },
    },
  };

  const client = {
    $transaction: async (work, options) => {
      calls.push(['$transaction', options]);
      return work(tx);
    },
  };

  const repository = new MissingCostResolutionRecoveryExecutionRepository(client);
  const authority = {
    branchId: 3,
    resolutionId: 77,
    approvedVersion: 4,
    sourceSnapshotHash: 'snapshot-4',
    evidenceHash: 'evidence-4',
    idempotencyKey: 'idem-77',
    executionAuthorityHash: 'authority-hash-77',
    executorIdentity: 'employee:12',
    approvalIdentity: 'employee:14',
    operations: [{
      stockBalanceId: 19,
      productId: 8,
      expectedQuantity: 6,
      approvedUnitCost: 125,
    }],
  };

  const result = await repository.transaction(async (scopedRepository) => {
    await scopedRepository.assertIdempotencyAvailable({
      branchId: authority.branchId,
      resolutionId: authority.resolutionId,
      idempotencyKey: authority.idempotencyKey,
      executionAuthorityHash: authority.executionAuthorityHash,
    });
    const runtime = await scopedRepository.revalidateExecutionAuthority({ authority });
    return scopedRepository.applyApprovedUnitCost({ authority, runtime });
  });

  assert.equal(calls[0][0], '$transaction');
  assert.equal(calls[0][1].isolationLevel, 'Serializable');

  const resolutionRead = calls.find(([name]) => name === 'missingCostResolution.findFirst')[1];
  assert.equal(resolutionRead.where.branchId, 3);
  assert.equal(resolutionRead.where.status, 'APPROVED');
  assert.equal(resolutionRead.where.currentVersion, 4);
  assert.equal(resolutionRead.where.sourceSnapshotHash, 'snapshot-4');
  assert.equal(resolutionRead.include.versions.where.evidenceHash, 'evidence-4');

  const stockRead = calls.find(([name]) => name === 'stockBalance.findFirst')[1];
  assert.deepEqual(stockRead.where, { id: 19, branchId: 3, productId: 8 });

  const stockUpdate = calls.find(([name]) => name === 'stockBalance.updateMany')[1];
  assert.deepEqual(stockUpdate.where, {
    id: 19,
    branchId: 3,
    productId: 8,
    quantity: 6,
  });
  assert.equal(stockUpdate.data.avgCost, 125);
  assert.equal(stockUpdate.data.lastReceivedCost, 125);

  const audit = calls.find(([name]) => name === 'missingCostResolutionEvent.create')[1].data;
  assert.equal(audit.eventType, 'RECOVERY_EXECUTED');
  assert.equal(audit.previousStatus, 'APPROVED');
  assert.equal(audit.resultingStatus, 'APPROVED');
  assert.equal(audit.evidenceHash, 'evidence-4');
  assert.equal(result.appliedUnitCost, 125);
  assert.equal(result.resultingInventoryValue, 750);

  const duplicateRepository = new MissingCostResolutionRecoveryExecutionRepository({
    missingCostResolutionEvent: {
      findFirst: async () => ({ id: 1 }),
    },
  });
  await assert.rejects(
    () => duplicateRepository.assertIdempotencyAvailable({
      branchId: 3,
      resolutionId: 77,
      idempotencyKey: 'idem-77',
      executionAuthorityHash: 'authority-hash-77',
    }),
    (error) => error.code === 'MISSING_COST_RECOVERY_DUPLICATE_EXECUTION'
  );

  console.log('missing-cost-resolution-recovery-execution-repository.contract.test.js: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
