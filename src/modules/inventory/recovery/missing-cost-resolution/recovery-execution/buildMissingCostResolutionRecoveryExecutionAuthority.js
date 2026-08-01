const { sha256 } = require('../contracts/missingCostResolutionContract');

const EXECUTION_AUTHORITY_VERSION = 'missing-cost-resolution-recovery-execution-authority-v1';

const fail = (code, message, details = undefined) => {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  throw error;
};

const requireText = (value, field) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    fail('MISSING_COST_RECOVERY_EXECUTION_INVALID_AUTHORITY', `${field} is required`, { field });
  }
  return normalized;
};

const requirePositiveInteger = (value, field) => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    fail('MISSING_COST_RECOVERY_EXECUTION_INVALID_AUTHORITY', `${field} must be a positive integer`, { field, value });
  }
  return normalized;
};

const requirePlan = (plan) => {
  if (!plan || plan.validation?.result !== 'VALIDATED_APPROVAL_PLAN_ONLY') {
    fail('MISSING_COST_RECOVERY_VALIDATED_PLAN_REQUIRED', 'A validated approval plan is required');
  }
  if (plan.validation?.stale) {
    fail('MISSING_COST_RECOVERY_STALE_PLAN', 'Stale approval plan cannot produce execution authority');
  }
  if (plan.mutationPerformed || plan.approvedForMutation || plan.executable) {
    fail('MISSING_COST_RECOVERY_PLAN_STATE_INVALID', 'Plan-only authority was already mutated or promoted');
  }
  return plan;
};

const buildMissingCostResolutionRecoveryExecutionAuthority = ({
  plan,
  approval,
  executorIdentity,
}) => {
  const validatedPlan = requirePlan(plan);
  const branchId = requirePositiveInteger(validatedPlan.branchId, 'plan.branchId');
  const resolutionId = requirePositiveInteger(validatedPlan.resolutionId, 'plan.resolutionId');
  const approvedVersion = requirePositiveInteger(validatedPlan.approvedVersion, 'plan.approvedVersion');
  const executionPlanId = requireText(validatedPlan.executionPlanId, 'plan.executionPlanId');
  const executionPlanHash = requireText(validatedPlan.executionPlanHash, 'plan.executionPlanHash');
  const previewId = requireText(validatedPlan.previewId, 'plan.previewId');
  const previewHash = requireText(validatedPlan.previewHash, 'plan.previewHash');
  const sourceSnapshotHash = requireText(validatedPlan.sourceSnapshotHash, 'plan.sourceSnapshotHash');
  const evidenceHash = requireText(validatedPlan.evidenceHash, 'plan.evidenceHash');
  const operatorIdentity = requireText(validatedPlan.operatorIdentity, 'plan.operatorIdentity');
  const executor = requireText(executorIdentity, 'executorIdentity');

  const approvedPlanId = requireText(approval?.executionPlanId, 'approval.executionPlanId');
  const approvedPlanHash = requireText(approval?.executionPlanHash, 'approval.executionPlanHash');
  const approvedPreviewId = requireText(approval?.previewId, 'approval.previewId');
  const approvedPreviewHash = requireText(approval?.previewHash, 'approval.previewHash');
  const approvedSourceSnapshotHash = requireText(approval?.sourceSnapshotHash, 'approval.sourceSnapshotHash');
  const approvedEvidenceHash = requireText(approval?.evidenceHash, 'approval.evidenceHash');
  const approvedOperatorIdentity = requireText(approval?.operatorIdentity, 'approval.operatorIdentity');
  const approvalIdentity = requireText(approval?.approvalIdentity, 'approval.approvalIdentity');
  const idempotencyKey = requireText(approval?.idempotencyKey, 'approval.idempotencyKey');

  const expectedAuthority = {
    executionPlanId,
    executionPlanHash,
    previewId,
    previewHash,
    sourceSnapshotHash,
    evidenceHash,
    operatorIdentity,
  };
  const suppliedAuthority = {
    executionPlanId: approvedPlanId,
    executionPlanHash: approvedPlanHash,
    previewId: approvedPreviewId,
    previewHash: approvedPreviewHash,
    sourceSnapshotHash: approvedSourceSnapshotHash,
    evidenceHash: approvedEvidenceHash,
    operatorIdentity: approvedOperatorIdentity,
  };

  for (const field of Object.keys(expectedAuthority)) {
    if (suppliedAuthority[field] !== expectedAuthority[field]) {
      fail('MISSING_COST_RECOVERY_APPROVAL_STALE', `Explicit approval does not match ${field}`, {
        field,
        expected: expectedAuthority[field],
        actual: suppliedAuthority[field],
      });
    }
  }

  if (approvalIdentity === operatorIdentity || approvalIdentity === executor) {
    fail(
      'MISSING_COST_RECOVERY_SEPARATE_EXECUTION_APPROVAL_REQUIRED',
      'Approval identity must be separate from the plan operator and execution actor'
    );
  }

  const authority = {
    executionAuthorityVersion: EXECUTION_AUTHORITY_VERSION,
    branchId,
    resolutionId,
    approvedVersion,
    executionPlanId,
    executionPlanHash,
    previewId,
    previewHash,
    sourceSnapshotHash,
    evidenceHash,
    operatorIdentity,
    approvalIdentity,
    executorIdentity: executor,
    idempotencyKey,
    operations: validatedPlan.operations,
    totals: validatedPlan.totals,
  };
  const executionAuthorityHash = sha256(authority);

  return Object.freeze({
    ...authority,
    executionAuthorityId: `mcr-exec-${branchId}-${resolutionId}-${executionAuthorityHash.slice(0, 24)}`,
    executionAuthorityHash,
    mode: 'EXECUTION_AUTHORITY_ONLY',
    validation: {
      result: 'VALIDATED_EXECUTION_AUTHORITY_ONLY',
      stale: false,
    },
    mutationPerformed: false,
    executable: false,
    approvedForMutation: false,
    transactionContract: {
      requiresSerializableTransaction: true,
      duplicateExecutionMustReject: true,
      staleDataMustAbort: true,
      exactPlanAuthorityRequired: true,
      exactApprovedEvidenceRequired: true,
      separateApprovalRequired: true,
      mutationRequiresRepositoryIncrement: true,
    },
  });
};

module.exports = {
  EXECUTION_AUTHORITY_VERSION,
  buildMissingCostResolutionRecoveryExecutionAuthority,
};
