const assert = require('node:assert/strict');
const {
  buildMissingCostResolutionRecoveryApprovalPlan,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/recovery-plan/buildMissingCostResolutionRecoveryApprovalPlan');

const preview = {
  previewVersion: 'missing-cost-resolution-recovery-preview-v1',
  previewId: 'mcr-preview-2-11-abc',
  previewHash: 'preview-hash-1',
  branchId: 2,
  resolutionId: 11,
  approvedVersion: 3,
  stockBalanceId: 21,
  productId: 31,
  sourceSnapshotHash: 'snapshot-1',
  evidenceHash: 'evidence-1',
  proposedUnitCost: 125,
  operatorIdentity: 'employee:42',
  validation: {
    stale: false,
    staleReasons: [],
    result: 'VALIDATED_PREVIEW_ONLY',
  },
  proposedRecovery: {
    quantity: 4,
    unitCost: 125,
    inventoryValue: 500,
  },
  mutationPerformed: false,
  executable: false,
};

const first = buildMissingCostResolutionRecoveryApprovalPlan({ preview });
const second = buildMissingCostResolutionRecoveryApprovalPlan({ preview });

assert.deepEqual(first, second);
assert.equal(first.mode, 'PLAN_ONLY');
assert.equal(first.validation.result, 'VALIDATED_APPROVAL_PLAN_ONLY');
assert.equal(first.mutationPerformed, false);
assert.equal(first.executable, false);
assert.equal(first.approvedForMutation, false);
assert.equal(first.operations.length, 1);
assert.equal(first.operations[0].approvedUnitCost, 125);
assert.equal(first.totals.totalQuantity, 4);
assert.equal(first.totals.totalInventoryValue, 500);
assert.deepEqual(first.approvalContract.requiredApprovalInputs, [
  'executionPlanId',
  'executionPlanHash',
  'previewId',
  'previewHash',
  'sourceSnapshotHash',
  'evidenceHash',
  'operatorIdentity',
]);

assert.throws(
  () => buildMissingCostResolutionRecoveryApprovalPlan({
    preview: {
      ...preview,
      validation: { stale: true, result: 'STALE_ABORT_REQUIRED' },
    },
  }),
  (error) => error.code === 'MISSING_COST_RECOVERY_VALIDATED_PREVIEW_REQUIRED'
);

assert.throws(
  () => buildMissingCostResolutionRecoveryApprovalPlan({
    preview: {
      ...preview,
      proposedRecovery: { ...preview.proposedRecovery, unitCost: 0 },
    },
  }),
  (error) => error.code === 'MISSING_COST_RECOVERY_PLAN_INVALID_AUTHORITY'
);

assert.throws(
  () => buildMissingCostResolutionRecoveryApprovalPlan({
    preview: {
      ...preview,
      proposedRecovery: { ...preview.proposedRecovery, quantity: -1 },
    },
  }),
  (error) => error.code === 'MISSING_COST_RECOVERY_PLAN_INVALID_QUANTITY'
);

console.log('missing-cost-resolution-recovery-approval-plan.contract.test.js: PASS');
