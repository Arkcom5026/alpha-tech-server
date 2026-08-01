const assert = require('node:assert/strict');
const {
  MissingCostResolutionRecoveryAuditRepository,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/recovery-audit/repository/missingCostResolutionRecoveryAuditRepository');
const {
  MissingCostResolutionRecoveryAuditService,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/recovery-audit/service/missingCostResolutionRecoveryAuditService');

(async () => {
  const calls = [];
  const event = {
    id: 81,
    eventType: 'RECOVERY_EXECUTED',
    eventHash: 'event-hash',
    evidenceHash: 'evidence-hash',
    candidateSnapshotHash: 'snapshot-hash',
    reasonCode: 'APPROVED_COST_RECOVERY_EXECUTED',
    note: 'executor=employee:9; approver=employee:8',
    occurredAt: new Date('2026-08-01T12:00:00Z'),
    version: {
      id: 71,
      version: 3,
      evidenceHash: 'evidence-hash',
      proposedUnitCost: 125,
      approvedAt: new Date('2026-08-01T11:00:00Z'),
      approvedByEmployeeId: 8,
    },
    resolution: {
      stockBalance: {
        id: 51,
        branchId: 7,
        productId: 9,
        quantity: 4,
        avgCost: 125,
        lastReceivedCost: 125,
      },
    },
  };
  const prisma = {
    missingCostResolutionEvent: {
      findFirst: async (args) => {
        calls.push(['findFirst', args]);
        return event;
      },
      findMany: async (args) => {
        calls.push(['findMany', args]);
        return [event];
      },
    },
  };

  const repository = new MissingCostResolutionRecoveryAuditRepository(prisma);
  const service = new MissingCostResolutionRecoveryAuditService(repository);
  const result = await service.getPostRecoveryAudit({ branchId: 7, resolutionId: 11 });

  assert.equal(calls[0][1].where.resolution.branchId, 7);
  assert.equal(calls[0][1].where.resolutionId, 11);
  assert.equal(calls[0][1].where.eventType, 'RECOVERY_EXECUTED');
  assert.equal(result.mode, 'POST_RECOVERY_AUDIT_READ_ONLY');
  assert.equal(result.mutationPerformed, false);
  assert.equal(result.resultingInventoryAuthority.inventoryValue, 500);
  assert.equal(result.latestExecution.approvedVersion.evidenceHash, 'evidence-hash');
  assert.equal(result.immutableExecutionHistory.length, 1);

  const source = [
    require('node:fs').readFileSync(require.resolve('../src/modules/inventory/recovery/missing-cost-resolution/recovery-audit/repository/missingCostResolutionRecoveryAuditRepository'), 'utf8'),
    require('node:fs').readFileSync(require.resolve('../src/modules/inventory/recovery/missing-cost-resolution/recovery-audit/service/missingCostResolutionRecoveryAuditService'), 'utf8'),
    require('node:fs').readFileSync(require.resolve('../src/modules/inventory/recovery/missing-cost-resolution/runtime/controller/missingCostResolutionRecoveryAuditController'), 'utf8'),
  ].join('\n');
  assert.doesNotMatch(source, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/);

  console.log('missing-cost-resolution-recovery-audit.contract.test.js: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
