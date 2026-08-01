const assert = require('node:assert/strict');
const {
  MissingCostResolutionRecoveryExecutionService,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/recovery-execution/service/missingCostResolutionRecoveryExecutionService');

const preview = {
  previewVersion: 'missing-cost-resolution-recovery-preview-v1',
  previewId: 'mcr-preview-7-11-abc',
  previewHash: 'preview-hash',
  branchId: 7,
  resolutionId: 11,
  approvedVersion: 2,
  stockBalanceId: 5,
  productId: 9,
  sourceSnapshotHash: 'snapshot-1',
  evidenceHash: 'evidence-1',
  proposedUnitCost: 125,
  operatorIdentity: 'employee:40',
  validation: { stale: false, staleReasons: [], result: 'VALIDATED_PREVIEW_ONLY' },
  proposedRecovery: { quantity: 4, unitCost: 125, inventoryValue: 500 },
  mutationPerformed: false,
  executable: false,
  directExecutionAllowed: false,
  requiresDeterministicApprovalPlan: true,
};

(async () => {
  const calls = [];
  const previewService = {
    buildPreview: async (args) => {
      calls.push(['buildPreview', args]);
      return preview;
    },
  };
  const repository = {
    execute: async (args) => {
      calls.push(['execute', args]);
      return {
        result: 'MISSING_COST_RECOVERY_EXECUTED',
        mutationPerformed: true,
        executionAuthorityId: args.executionAuthority.executionAuthorityId,
      };
    },
  };

  const service = new MissingCostResolutionRecoveryExecutionService({
    recoveryPreviewService: previewService,
    repository,
  });

  const planOperator = 'employee:40';
  const approval = {
    executionPlanId: '',
    executionPlanHash: '',
    previewId: preview.previewId,
    previewHash: preview.previewHash,
    sourceSnapshotHash: preview.sourceSnapshotHash,
    evidenceHash: preview.evidenceHash,
    operatorIdentity: planOperator,
    approvalIdentity: 'employee:41',
    idempotencyKey: 'mcr-exec-7-11-1',
  };

  const {
    buildMissingCostResolutionRecoveryApprovalPlan,
  } = require('../src/modules/inventory/recovery/missing-cost-resolution/recovery-plan/buildMissingCostResolutionRecoveryApprovalPlan');
  const plan = buildMissingCostResolutionRecoveryApprovalPlan({ preview, operatorIdentity: planOperator });
  approval.executionPlanId = plan.executionPlanId;
  approval.executionPlanHash = plan.executionPlanHash;

  const result = await service.execute({
    branchId: 7,
    resolutionId: 11,
    operatorIdentity: planOperator,
    executorIdentity: 'employee:42',
    approval,
  });

  assert.equal(result.mutationPerformed, true);
  assert.deepEqual(calls[0], ['buildPreview', {
    branchId: 7,
    resolutionId: 11,
    operatorIdentity: planOperator,
  }]);
  assert.equal(calls[1][0], 'execute');
  assert.equal(calls[1][1].plan.executionPlanId, plan.executionPlanId);
  assert.equal(calls[1][1].preview.previewHash, preview.previewHash);
  assert.equal(calls[1][1].executionAuthority.validation.result, 'VALIDATED_EXECUTION_AUTHORITY_ONLY');
  assert.equal(calls[1][1].executionAuthority.approvalIdentity, 'employee:41');
  assert.equal(calls[1][1].executionAuthority.executorIdentity, 'employee:42');

  await assert.rejects(
    () => service.execute({
      branchId: 7,
      resolutionId: 11,
      operatorIdentity: '',
      executorIdentity: 'employee:42',
      approval,
    }),
    (error) => error.code === 'MISSING_COST_RECOVERY_EXECUTION_INPUT_REQUIRED'
  );

  await assert.rejects(
    () => service.execute({
      branchId: 7,
      resolutionId: 11,
      operatorIdentity: planOperator,
      executorIdentity: 'employee:41',
      approval,
    }),
    (error) => error.code === 'MISSING_COST_RECOVERY_SEPARATE_EXECUTION_APPROVAL_REQUIRED'
  );

  console.log('missing-cost-resolution-recovery-execution-service.contract.test.js: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
