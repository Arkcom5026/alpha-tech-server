const { sha256 } = require('../contracts/missingCostResolutionContract');

const PREVIEW_VERSION = 'missing-cost-resolution-recovery-preview-v1';

const fail = (code, message, details = undefined) => {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  throw error;
};

const requirePositiveInteger = (value, field) => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    fail('MISSING_COST_RECOVERY_INVALID_AUTHORITY', `${field} must be a positive integer`, { field, value });
  }
  return normalized;
};

const requireText = (value, field) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    fail('MISSING_COST_RECOVERY_INVALID_AUTHORITY', `${field} is required`, { field });
  }
  return normalized;
};

const requirePositiveCost = (value) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    fail('MISSING_COST_RECOVERY_INVALID_COST', 'Approved proposed unit cost must be greater than zero', { value });
  }
  return normalized;
};

const buildApprovedResolutionRecoveryPreview = ({ resolution, currentSource, operatorIdentity }) => {
  if (!resolution) fail('MISSING_COST_RESOLUTION_NOT_FOUND', 'Missing cost resolution was not found');
  if (resolution.status !== 'APPROVED') {
    fail('MISSING_COST_RESOLUTION_NOT_APPROVED', 'Only an approved resolution can produce a recovery preview');
  }

  const branchId = requirePositiveInteger(resolution.branchId, 'resolution.branchId');
  const resolutionId = requirePositiveInteger(resolution.id, 'resolution.id');
  const stockBalanceId = requirePositiveInteger(resolution.stockBalanceId, 'resolution.stockBalanceId');
  const productId = requirePositiveInteger(resolution.productId, 'resolution.productId');
  const approvedVersion = requirePositiveInteger(resolution.currentVersion, 'resolution.currentVersion');
  const sourceSnapshotHash = requireText(resolution.sourceSnapshotHash, 'resolution.sourceSnapshotHash');
  const evidence = resolution.approvedVersion || resolution.versions?.[0] || null;
  if (!evidence || Number(evidence.version) !== approvedVersion || !evidence.approvedAt) {
    fail('MISSING_COST_RESOLUTION_APPROVED_VERSION_REQUIRED', 'Approved evidence version authority is missing');
  }

  const evidenceHash = requireText(evidence.evidenceHash, 'evidence.evidenceHash');
  const proposedUnitCost = requirePositiveCost(evidence.proposedUnitCost);
  const approvedByEmployeeId = requirePositiveInteger(
    evidence.approvalSnapshot?.approvedByEmployeeId,
    'evidence.approvalSnapshot.approvedByEmployeeId'
  );
  const approvalIdentity = `employee:${approvedByEmployeeId}`;
  const operator = requireText(operatorIdentity, 'operatorIdentity');

  if (!currentSource) fail('MISSING_COST_RECOVERY_SOURCE_NOT_FOUND', 'Current inventory source was not found');

  const staleReasons = [];
  const compare = (actual, expected, code) => {
    if (String(actual) !== String(expected)) staleReasons.push(code);
  };
  compare(currentSource.branchId, branchId, 'BRANCH_CHANGED');
  compare(currentSource.stockBalanceId, stockBalanceId, 'STOCK_BALANCE_CHANGED');
  compare(currentSource.productId, productId, 'PRODUCT_CHANGED');
  compare(currentSource.sourceSnapshotHash, sourceSnapshotHash, 'SOURCE_SNAPSHOT_CHANGED');

  const authority = {
    previewVersion: PREVIEW_VERSION,
    branchId,
    resolutionId,
    approvedVersion,
    stockBalanceId,
    productId,
    sourceSnapshotHash,
    evidenceHash,
    proposedUnitCost,
    approvalIdentity,
    operatorIdentity: operator,
    currentSource: {
      branchId: Number(currentSource.branchId),
      stockBalanceId: Number(currentSource.stockBalanceId),
      productId: Number(currentSource.productId),
      sourceSnapshotHash: String(currentSource.sourceSnapshotHash || ''),
      quantity: Number(currentSource.quantity ?? 0),
      currentUnitCost: currentSource.currentUnitCost == null ? null : Number(currentSource.currentUnitCost),
    },
    staleReasons: [...staleReasons].sort(),
  };
  const previewHash = sha256(authority);

  return Object.freeze({
    previewVersion: PREVIEW_VERSION,
    previewId: `mcr-preview-${branchId}-${resolutionId}-${previewHash.slice(0, 24)}`,
    previewHash,
    branchId,
    resolutionId,
    approvedVersion,
    stockBalanceId,
    productId,
    sourceSnapshotHash,
    evidenceHash,
    proposedUnitCost,
    approvalIdentity,
    operatorIdentity: operator,
    validation: {
      stale: staleReasons.length > 0,
      staleReasons: [...staleReasons].sort(),
      result: staleReasons.length > 0 ? 'STALE_ABORT_REQUIRED' : 'VALIDATED_PREVIEW_ONLY',
    },
    proposedRecovery: {
      quantity: Number(currentSource.quantity ?? 0),
      unitCost: proposedUnitCost,
      inventoryValue: Number(currentSource.quantity ?? 0) * proposedUnitCost,
    },
    mutationPerformed: false,
    executable: false,
    directExecutionAllowed: false,
    requiresDeterministicApprovalPlan: true,
  });
};

module.exports = {
  PREVIEW_VERSION,
  buildApprovedResolutionRecoveryPreview,
};
