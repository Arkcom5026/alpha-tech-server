const assert = require('assert');
const {
  buildApprovedResolutionRecoveryPreview,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/recovery-preview/buildApprovedResolutionRecoveryPreview');

const resolution = {
  id: 71,
  branchId: 7,
  stockBalanceId: 5,
  productId: 9,
  status: 'APPROVED',
  currentVersion: 2,
  sourceSnapshotHash: 'snapshot-1',
  approvedVersion: {
    version: 2,
    approvedAt: '2026-08-01T00:00:00.000Z',
    evidenceHash: 'evidence-1',
    proposedUnitCost: 125,
  },
};

const currentSource = {
  branchId: 7,
  stockBalanceId: 5,
  productId: 9,
  sourceSnapshotHash: 'snapshot-1',
  quantity: 4,
  currentUnitCost: null,
};

const first = buildApprovedResolutionRecoveryPreview({
  resolution,
  currentSource,
  operatorIdentity: 'employee:42',
});
const second = buildApprovedResolutionRecoveryPreview({
  resolution,
  currentSource,
  operatorIdentity: 'employee:42',
});

assert.strictEqual(first.validation.result, 'VALIDATED_PREVIEW_ONLY');
assert.strictEqual(first.validation.stale, false);
assert.strictEqual(first.proposedRecovery.inventoryValue, 500);
assert.strictEqual(first.mutationPerformed, false);
assert.strictEqual(first.executable, false);
assert.strictEqual(first.previewHash, second.previewHash);
assert.strictEqual(first.previewId, second.previewId);

const stale = buildApprovedResolutionRecoveryPreview({
  resolution,
  currentSource: { ...currentSource, sourceSnapshotHash: 'snapshot-2' },
  operatorIdentity: 'employee:42',
});
assert.strictEqual(stale.validation.result, 'STALE_ABORT_REQUIRED');
assert.deepStrictEqual(stale.validation.staleReasons, ['SOURCE_SNAPSHOT_CHANGED']);

assert.throws(() => buildApprovedResolutionRecoveryPreview({
  resolution: { ...resolution, status: 'SUBMITTED' },
  currentSource,
  operatorIdentity: 'employee:42',
}), (error) => error.code === 'MISSING_COST_RESOLUTION_NOT_APPROVED');

assert.throws(() => buildApprovedResolutionRecoveryPreview({
  resolution: {
    ...resolution,
    approvedVersion: { ...resolution.approvedVersion, proposedUnitCost: 0 },
  },
  currentSource,
  operatorIdentity: 'employee:42',
}), (error) => error.code === 'MISSING_COST_RECOVERY_INVALID_COST');

console.log('Missing Cost Resolution recovery preview contract: PASS');
