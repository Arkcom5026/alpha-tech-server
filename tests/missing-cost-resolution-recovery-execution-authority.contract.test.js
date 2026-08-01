const assert = require('node:assert/strict');
const {
  buildMissingCostResolutionRecoveryExecutionAuthority,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/recovery-execution/buildMissingCostResolutionRecoveryExecutionAuthority');

const plan = {
  validation: { result: 'VALIDATED_APPROVAL_PLAN_ONLY', stale: false },
  branchId: 7,
  resolutionId: 11,
  approvedVersion: 3,
  executionPlanId: 'mcr-plan-7-11-abc',
  executionPlanHash: 'plan-hash',
  previewId: 'mcr-preview-7-11-abc',
  previewHash: 'preview-hash',
  sourceSnapshotHash: 'snapshot-hash',
  evidenceHash: 'evidence-hash',
  operatorIdentity: 'employee:40',
  approvalIdentity: 'employee:41',
  operations: [{ sequence: 1, operationType: 'APPLY_APPROVED_UNIT_COST_TO_RECOVERY_AUTHORITY' }],
  totals: { operationCount: 1, totalQuantity: 5, totalInventoryValue: 625 },
  mutationPerformed: false,
  approvedForMutation: false,
  executable: false,
};

const approval = {
  executionPlanId: plan.executionPlanId,
  executionPlanHash: plan.executionPlanHash,
  previewId: plan.previewId,
  previewHash: plan.previewHash,
  sourceSnapshotHash: plan.sourceSnapshotHash,
  evidenceHash: plan.evidenceHash,
  operatorIdentity: plan.operatorIdentity,
  idempotencyKey: 'mcr-execution-7-11-001',
};

const first = buildMissingCostResolutionRecoveryExecutionAuthority({ plan, approval, executorIdentity: 'employee:42' });
const second = buildMissingCostResolutionRecoveryExecutionAuthority({ plan, approval, executorIdentity: 'employee:42' });

assert.equal(first.executionAuthorityHash, second.executionAuthorityHash);
assert.equal(first.executionAuthorityId, second.executionAuthorityId);
assert.equal(first.approvalIdentity, plan.approvalIdentity);
assert.equal(first.transactionContract.approvalIdentityIsServerOwned, true);
assert.equal(first.validation.result, 'VALIDATED_EXECUTION_AUTHORITY_ONLY');
assert.equal(first.mutationPerformed, false);
assert.equal(first.executable, false);
assert.equal(first.approvedForMutation, false);
assert.equal(first.transactionContract.requiresSerializableTransaction, true);
assert.equal(first.transactionContract.duplicateExecutionMustReject, true);
assert.equal(first.transactionContract.separateApprovalRequired, true);

assert.throws(() => buildMissingCostResolutionRecoveryExecutionAuthority({
  plan,
  approval: { ...approval, executionPlanHash: 'stale-plan-hash' },
  executorIdentity: 'employee:42',
}), (error) => error.code === 'MISSING_COST_RECOVERY_APPROVAL_STALE');

assert.throws(() => buildMissingCostResolutionRecoveryExecutionAuthority({
  plan: { ...plan, approvalIdentity: plan.operatorIdentity },
  approval,
  executorIdentity: 'employee:42',
}), (error) => error.code === 'MISSING_COST_RECOVERY_SEPARATE_EXECUTION_APPROVAL_REQUIRED');

assert.throws(() => buildMissingCostResolutionRecoveryExecutionAuthority({
  plan: { ...plan, approvalIdentity: 'employee:42' },
  approval,
  executorIdentity: 'employee:42',
}), (error) => error.code === 'MISSING_COST_RECOVERY_SEPARATE_EXECUTION_APPROVAL_REQUIRED');

assert.throws(() => buildMissingCostResolutionRecoveryExecutionAuthority({
  plan: { ...plan, validation: { result: 'STALE_ABORT_REQUIRED', stale: true } },
  approval,
  executorIdentity: 'employee:42',
}), (error) => error.code === 'MISSING_COST_RECOVERY_VALIDATED_PLAN_REQUIRED');

assert.throws(() => buildMissingCostResolutionRecoveryExecutionAuthority({
  plan,
  approval: { ...approval, idempotencyKey: '' },
  executorIdentity: 'employee:42',
}), (error) => error.code === 'MISSING_COST_RECOVERY_EXECUTION_INVALID_AUTHORITY');

console.log('missing-cost-resolution-recovery-execution-authority.contract.test.js: PASS');
