const assert = require('node:assert/strict');
const {
  MissingCostResolutionReadRepository,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/runtime/repository/missingCostResolutionReadRepository');
const {
  MissingCostResolutionReadService,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/runtime/service/missingCostResolutionReadService');
const {
  buildRuntimeQueueDto,
  buildRuntimeDetailDto,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/runtime/mappers/missingCostResolutionReadMapper');

(async () => {
  const calls = [];
  const prisma = {
    missingCostResolution: {
      findMany: async (args) => {
        calls.push({ method: 'findMany', args });
        return [];
      },
      findFirst: async (args) => {
        calls.push({ method: 'findFirst', args });
        return null;
      },
    },
    missingCostResolutionEvent: {
      findMany: async (args) => {
        calls.push({ method: 'eventFindMany', args });
        return [];
      },
    },
  };

  const repository = new MissingCostResolutionReadRepository(prisma);
  await repository.findQueue({ branchId: 2, status: 'DRAFT', limit: 25, offset: 0 });
  assert.equal(calls[0].args.where.branchId, 2);
  assert.equal(calls[0].args.where.status, 'DRAFT');

  await repository.findDetail({ branchId: 3, resolutionId: 99 });
  assert.deepEqual(calls[1].args.where, { id: 99, branchId: 3 });

  await repository.findAuditHistory({ branchId: 4, resolutionId: 100 });
  assert.equal(calls[2].args.where.resolutionId, 100);
  assert.equal(calls[2].args.where.resolution.branchId, 4);

  const service = new MissingCostResolutionReadService(repository);
  await assert.rejects(
    () => service.getDetail({ branchId: 3, resolutionId: 99 }),
    (error) => error.code === 'MISSING_COST_RESOLUTION_NOT_FOUND' && error.statusCode === 404
  );
  await assert.rejects(
    () => service.getDetail({ branchId: null, resolutionId: 99 }),
    (error) => error.code === 'MISSING_COST_BRANCH_REQUIRED' && error.statusCode === 403
  );

  const row = {
    id: 7,
    branchId: 2,
    stockBalanceId: 11,
    productId: 12,
    candidateId: 'candidate-7',
    candidateEntryId: 'entry-7',
    candidateIdentityHash: 'identity-hash',
    sourceAuditId: 'audit-1',
    sourceSnapshotHash: 'snapshot-1',
    status: 'DRAFT',
    currentVersion: 1,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:01:00Z'),
    approvedAt: null,
    product: { id: 12, name: 'Example', sku: 'EX-1' },
    stockBalance: {
      id: 11,
      branchId: 2,
      productId: 12,
      quantity: 5,
      avgCost: null,
      lastReceivedCost: null,
    },
    versions: [],
    events: [],
  };

  const queueDto = buildRuntimeQueueDto({ branchId: 2, rows: [row] });
  assert.equal(queueDto.mutationPerformed, false);
  assert.equal(queueDto.capabilities.createProposal, false);
  assert.equal(queueDto.capabilities.submitProposal, false);
  assert.equal(queueDto.capabilities.reviewProposal, false);
  assert.equal(queueDto.capabilities.executeInventoryRecovery, false);

  const detailDto = buildRuntimeDetailDto(row);
  assert.equal(detailDto.capabilities.saveDraft, false);
  assert.equal(detailDto.capabilities.approve, false);
  assert.equal(detailDto.capabilities.executeInventoryRecovery, false);
  assert.equal(detailDto.candidate.branchId, 2);

  const sourceFiles = [
    require('node:fs').readFileSync(require.resolve('../src/modules/inventory/recovery/missing-cost-resolution/runtime/repository/missingCostResolutionReadRepository'), 'utf8'),
    require('node:fs').readFileSync(require.resolve('../src/modules/inventory/recovery/missing-cost-resolution/runtime/service/missingCostResolutionReadService'), 'utf8'),
    require('node:fs').readFileSync(require.resolve('../src/modules/inventory/recovery/missing-cost-resolution/runtime/controller/missingCostResolutionReadController'), 'utf8'),
    require('node:fs').readFileSync(require.resolve('../src/modules/inventory/recovery/missing-cost-resolution/runtime/routes/missingCostResolutionReadRoutes'), 'utf8'),
  ].join('\n');
  assert.doesNotMatch(sourceFiles, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/);
  assert.doesNotMatch(sourceFiles, /router\.(post|put|patch|delete)\s*\(/);

  console.log('missing-cost-resolution-runtime-read.contract.test.js: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
