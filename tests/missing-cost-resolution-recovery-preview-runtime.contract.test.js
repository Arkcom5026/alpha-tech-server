const assert = require('node:assert/strict');
const {
  MissingCostResolutionRecoveryPreviewRepository,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/recovery-preview/repository/missingCostResolutionRecoveryPreviewRepository');
const {
  MissingCostResolutionRecoveryPreviewService,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/recovery-preview/service/missingCostResolutionRecoveryPreviewService');
const { sha256 } = require('../src/modules/inventory/recovery/missing-cost-resolution/contracts/missingCostResolutionContract');

(async () => {
  const calls = [];
  const prisma = {
    missingCostResolution: {
      findFirst: async (args) => {
        calls.push(['missingCostResolution.findFirst', args]);
        return null;
      },
    },
    stockBalance: {
      findFirst: async (args) => {
        calls.push(['stockBalance.findFirst', args]);
        return null;
      },
    },
  };

  const repository = new MissingCostResolutionRecoveryPreviewRepository(prisma);
  await repository.findApprovedResolution({ branchId: 7, resolutionId: 11 });
  assert.deepEqual(calls[0][1].where, {
    id: 11,
    branchId: 7,
    status: 'APPROVED',
  });

  await repository.findCurrentSource({ branchId: 7, stockBalanceId: 5, productId: 9 });
  assert.deepEqual(calls[1][1].where, {
    id: 5,
    branchId: 7,
    productId: 9,
  });

  const approvedResolution = {
    id: 11,
    branchId: 7,
    stockBalanceId: 5,
    productId: 9,
    status: 'APPROVED',
    currentVersion: 2,
    sourceSnapshotHash: '',
    versions: [{
      id: 21,
      version: 2,
      evidenceHash: 'evidence-1',
      proposedUnitCost: 125,
      approvedAt: new Date('2026-08-01T00:00:00.000Z'),
    }],
  };
  const sourceAuthority = {
    branchId: 7,
    stockBalanceId: 5,
    productId: 9,
    quantity: 3,
    avgCost: null,
    lastReceivedCost: null,
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
  approvedResolution.sourceSnapshotHash = sha256(sourceAuthority);

  const runtimeRepository = {
    findApprovedResolution: async ({ branchId, resolutionId }) => {
      assert.equal(branchId, 7);
      assert.equal(resolutionId, 11);
      return approvedResolution;
    },
    findCurrentSource: async ({ branchId, stockBalanceId, productId }) => {
      assert.deepEqual({ branchId, stockBalanceId, productId }, {
        branchId: 7,
        stockBalanceId: 5,
        productId: 9,
      });
      return {
        branchId: 7,
        stockBalanceId: 5,
        productId: 9,
        quantity: 3,
        currentUnitCost: null,
        sourceSnapshotHash: sha256(sourceAuthority),
        sourceAuthority,
      };
    },
  };

  const service = new MissingCostResolutionRecoveryPreviewService(runtimeRepository);
  const preview = await service.buildPreview({
    branchId: 7,
    resolutionId: 11,
    operatorIdentity: 'employee:42',
  });
  assert.equal(preview.validation.result, 'VALIDATED_PREVIEW_ONLY');
  assert.equal(preview.validation.stale, false);
  assert.equal(preview.proposedRecovery.unitCost, 125);
  assert.equal(preview.proposedRecovery.quantity, 3);
  assert.equal(preview.mutationPerformed, false);
  assert.equal(preview.executable, false);

  await assert.rejects(
    () => service.buildPreview({ branchId: null, resolutionId: 11, operatorIdentity: 'employee:42' }),
    (error) => error.code === 'MISSING_COST_BRANCH_REQUIRED'
  );
  await assert.rejects(
    () => service.buildPreview({ branchId: 7, resolutionId: 11, operatorIdentity: '' }),
    (error) => error.code === 'MISSING_COST_RECOVERY_OPERATOR_REQUIRED'
  );

  const notFoundService = new MissingCostResolutionRecoveryPreviewService({
    findApprovedResolution: async () => null,
  });
  await assert.rejects(
    () => notFoundService.buildPreview({ branchId: 7, resolutionId: 999, operatorIdentity: 'employee:42' }),
    (error) => error.code === 'MISSING_COST_RESOLUTION_NOT_FOUND' && error.statusCode === 404
  );

  const sourceFiles = [
    require('node:fs').readFileSync(require.resolve('../src/modules/inventory/recovery/missing-cost-resolution/recovery-preview/repository/missingCostResolutionRecoveryPreviewRepository'), 'utf8'),
    require('node:fs').readFileSync(require.resolve('../src/modules/inventory/recovery/missing-cost-resolution/recovery-preview/service/missingCostResolutionRecoveryPreviewService'), 'utf8'),
  ].join('\n');
  assert.doesNotMatch(sourceFiles, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/);

  console.log('missing-cost-resolution-recovery-preview-runtime.contract.test.js: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
