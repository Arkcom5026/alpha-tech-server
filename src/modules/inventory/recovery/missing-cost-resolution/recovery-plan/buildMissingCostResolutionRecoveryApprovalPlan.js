const { sha256 } = require('../contracts/missingCostResolutionContract');

const PLAN_VERSION = 'missing-cost-resolution-recovery-plan-v1';

const fail = (code, message, details = undefined) => {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  throw error;
};

const requireText = (value, field) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    fail('MISSING_COST_RECOVERY_PLAN_INVALID_AUTHORITY', `${field} is required`, { field });
  }
  return normalized;
};

const requirePositiveInteger = (value, field) => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    fail('MISSING_COST_RECOVERY_PLAN_INVALID_AUTHORITY', `${field} must be a positive integer`, { field, value });
  }
  return normalized;
};

const requirePositiveNumber = (value, field) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    fail('MISSING_COST_RECOVERY_PLAN_INVALID_AUTHORITY', `${field} must be greater than zero`, { field, value });
  }
  return normalized;
};

const buildMissingCostResolutionRecoveryApprovalPlan = ({ preview, operatorIdentity }) => {
  if (!preview || preview.validation?.result !== 'VALIDATED_PREVIEW_ONLY') {
    fail('MISSING_COST_RECOVERY_VALIDATED_PREVIEW_REQUIRED', 'A validated recovery preview is required');
  }
  if (preview.validation?.stale) {
    fail('MISSING_COST_RECOVERY_STALE_PREVIEW', 'Stale recovery preview cannot produce an approval plan');
  }

  const branchId = requirePositiveInteger(preview.branchId, 'preview.branchId');
  const resolutionId = requirePositiveInteger(preview.resolutionId, 'preview.resolutionId');
  const approvedVersion = requirePositiveInteger(preview.approvedVersion, 'preview.approvedVersion');
  const stockBalanceId = requirePositiveInteger(preview.stockBalanceId, 'preview.stockBalanceId');
  const productId = requirePositiveInteger(preview.productId, 'preview.productId');
  const sourceSnapshotHash = requireText(preview.sourceSnapshotHash, 'preview.sourceSnapshotHash');
  const evidenceHash = requireText(preview.evidenceHash, 'preview.evidenceHash');
  const previewId = requireText(preview.previewId, 'preview.previewId');
  const previewHash = requireText(preview.previewHash, 'preview.previewHash');
  const unitCost = requirePositiveNumber(preview.proposedRecovery?.unitCost, 'preview.proposedRecovery.unitCost');
  const quantity = Number(preview.proposedRecovery?.quantity ?? 0);
  if (!Number.isFinite(quantity) || quantity < 0) {
    fail('MISSING_COST_RECOVERY_PLAN_INVALID_QUANTITY', 'Preview quantity must be zero or greater');
  }
  const operator = requireText(operatorIdentity || preview.operatorIdentity, 'operatorIdentity');

  const operation = {
    sequence: 1,
    operationType: 'APPLY_APPROVED_UNIT_COST_TO_RECOVERY_AUTHORITY',
    branchId,
    resolutionId,
    approvedVersion,
    stockBalanceId,
    productId,
    sourceSnapshotHash,
    evidenceHash,
    expectedQuantity: quantity,
    approvedUnitCost: unitCost,
    projectedInventoryValue: quantity * unitCost,
  };

  const authority = {
    planVersion: PLAN_VERSION,
    branchId,
    resolutionId,
    approvedVersion,
    stockBalanceId,
    productId,
    sourceSnapshotHash,
    evidenceHash,
    previewId,
    previewHash,
    operatorIdentity: operator,
    operations: [operation],
  };
  const executionPlanHash = sha256(authority);

  return Object.freeze({
    planVersion: PLAN_VERSION,
    executionPlanId: `mcr-plan-${branchId}-${resolutionId}-${executionPlanHash.slice(0, 24)}`,
    executionPlanHash,
    branchId,
    resolutionId,
    approvedVersion,
    stockBalanceId,
    productId,
    sourceSnapshotHash,
    evidenceHash,
    previewId,
    previewHash,
    operatorIdentity: operator,
    mode: 'PLAN_ONLY',
    validation: {
      result: 'VALIDATED_APPROVAL_PLAN_ONLY',
      stale: false,
    },
    totals: {
      operationCount: 1,
      totalQuantity: quantity,
      totalInventoryValue: quantity * unitCost,
    },
    operations: [operation],
    mutationPerformed: false,
    executable: false,
    approvedForMutation: false,
    approvalContract: {
      requiresExplicitApproval: true,
      requiredApprovalInputs: [
        'executionPlanId',
        'executionPlanHash',
        'previewId',
        'previewHash',
        'sourceSnapshotHash',
        'evidenceHash',
        'operatorIdentity',
      ],
      staleDataMustAbort: true,
      duplicateExecutionMustReject: true,
      mutationRequiresSeparateIncrement: true,
    },
  });
};

module.exports = {
  PLAN_VERSION,
  buildMissingCostResolutionRecoveryApprovalPlan,
};
