const crypto = require('crypto');

const QUEUE_VERSION = 'missing-cost-resolution-queue-v1';

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableValue(value[key]);
    return result;
  }, {});
};

const sha256 = (value) => crypto
  .createHash('sha256')
  .update(JSON.stringify(stableValue(value)))
  .digest('hex');

const toPositiveInteger = (value, field) => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    const error = new Error(`${field} must be a positive integer`);
    error.code = 'MISSING_COST_QUEUE_INVALID_IDENTITY';
    throw error;
  }
  return normalized;
};

const normalizeAuditEntry = (entry) => ({
  entryId: String(entry.entryId),
  classification: String(entry.classification),
  reasonCode: String(entry.reasonCode),
  branchId: toPositiveInteger(entry.preconditions?.branchId, 'branchId'),
  stockBalanceId: toPositiveInteger(entry.preconditions?.stockBalanceId, 'stockBalanceId'),
  productId: toPositiveInteger(entry.preconditions?.productId, 'productId'),
  quantity: Number(entry.preconditions?.quantity || 0),
  reserved: Number(entry.preconditions?.reserved || 0),
  avgCost: Number(entry.preconditions?.avgCost || 0),
  lastReceivedCost: Number(entry.preconditions?.lastReceivedCost || 0),
  movementCount: Number(entry.preconditions?.movementCount || 0),
  movementIds: [...(entry.preconditions?.movementIds || [])].map(Number).sort((a, b) => a - b),
  movementEvidenceHash: String(entry.preconditions?.movementEvidenceHash || ''),
  preconditionHash: String(entry.preconditionHash || ''),
  movementSummary: {
    movementCount: Number(entry.movementSummary?.movementCount || 0),
    movementNetQuantity: Number(entry.movementSummary?.movementNetQuantity || 0),
    balanceQuantity: Number(entry.movementSummary?.balanceQuantity || 0),
    difference: Number(entry.movementSummary?.difference || 0),
  },
});

const buildMissingCostResolutionQueue = ({
  branchId,
  audit,
  resolutions = [],
}) => {
  const normalizedBranchId = toPositiveInteger(branchId, 'branchId');
  if (!audit || Number(audit.branchId) !== normalizedBranchId) {
    const error = new Error('Audit branch does not match requested branch');
    error.code = 'MISSING_COST_QUEUE_BRANCH_SCOPE_MISMATCH';
    throw error;
  }

  const latestResolutionByEntryId = new Map();
  for (const resolution of resolutions || []) {
    if (Number(resolution.branchId) !== normalizedBranchId) continue;
    const entryId = String(resolution.entryId || '');
    if (!entryId) continue;
    const previous = latestResolutionByEntryId.get(entryId);
    const currentVersion = Number(resolution.version || 0);
    if (!previous || currentVersion > Number(previous.version || 0)) {
      latestResolutionByEntryId.set(entryId, resolution);
    }
  }

  const candidates = (audit.missingCostEntries || [])
    .map(normalizeAuditEntry)
    .filter((entry) => entry.branchId === normalizedBranchId)
    .filter((entry) => {
      const resolution = latestResolutionByEntryId.get(entry.entryId);
      if (!resolution) return true;
      return !['APPROVED', 'SUPERSEDED', 'RECOVERED'].includes(String(resolution.status));
    })
    .map((entry) => {
      const resolution = latestResolutionByEntryId.get(entry.entryId) || null;
      const sourceSnapshot = {
        queueVersion: QUEUE_VERSION,
        branchId: normalizedBranchId,
        auditId: String(audit.auditId || ''),
        auditSourceSnapshotHash: String(audit.sourceSnapshotHash || ''),
        entry,
        resolution: resolution
          ? {
            id: resolution.id == null ? null : Number(resolution.id),
            version: Number(resolution.version || 0),
            status: String(resolution.status || 'DRAFT'),
            evidenceHash: resolution.evidenceHash == null
              ? null
              : String(resolution.evidenceHash),
          }
          : null,
      };
      const sourceSnapshotHash = sha256(sourceSnapshot);
      return {
        candidateId: `mcr-${normalizedBranchId}-${entry.stockBalanceId}-${sourceSnapshotHash.slice(0, 16)}`,
        branchId: normalizedBranchId,
        entryId: entry.entryId,
        stockBalanceId: entry.stockBalanceId,
        productId: entry.productId,
        status: resolution ? String(resolution.status || 'DRAFT') : 'UNRESOLVED',
        reasonCode: entry.reasonCode,
        quantity: entry.quantity,
        currentCostEvidence: {
          avgCost: entry.avgCost,
          lastReceivedCost: entry.lastReceivedCost,
          hasDefensibleCost: entry.avgCost > 0 || entry.lastReceivedCost > 0,
        },
        movementSummary: entry.movementSummary,
        movementIds: entry.movementIds,
        movementEvidenceHash: entry.movementEvidenceHash,
        preconditionHash: entry.preconditionHash,
        sourceSnapshotHash,
        staleDataContract: {
          auditId: String(audit.auditId || ''),
          auditSourceSnapshotHash: String(audit.sourceSnapshotHash || ''),
          candidateSourceSnapshotHash: sourceSnapshotHash,
        },
      };
    })
    .sort((a, b) => a.productId - b.productId || a.stockBalanceId - b.stockBalanceId);

  const queueSnapshot = {
    queueVersion: QUEUE_VERSION,
    branchId: normalizedBranchId,
    auditId: String(audit.auditId || ''),
    auditSourceSnapshotHash: String(audit.sourceSnapshotHash || ''),
    candidateIds: candidates.map((candidate) => candidate.candidateId),
  };
  const sourceSnapshotHash = sha256(queueSnapshot);

  return {
    queueVersion: QUEUE_VERSION,
    queueId: `mcrq-${normalizedBranchId}-${sourceSnapshotHash.slice(0, 24)}`,
    sourceSnapshotHash,
    branchId: normalizedBranchId,
    mode: 'READ_ONLY_QUEUE',
    mutationPerformed: false,
    summary: {
      candidateCount: candidates.length,
      unresolvedCount: candidates.filter((candidate) => candidate.status === 'UNRESOLVED').length,
      draftCount: candidates.filter((candidate) => candidate.status === 'DRAFT').length,
      submittedCount: candidates.filter((candidate) => candidate.status === 'SUBMITTED').length,
      returnedCount: candidates.filter((candidate) => candidate.status === 'RETURNED_FOR_CORRECTION').length,
      rejectedCount: candidates.filter((candidate) => candidate.status === 'REJECTED').length,
    },
    candidates,
    safetyContract: {
      branchScoped: true,
      excludesApprovedAndRecovered: true,
      zeroCostIsNotResolution: true,
      directInventoryMutationAllowed: false,
    },
  };
};

module.exports = {
  QUEUE_VERSION,
  buildMissingCostResolutionQueue,
  sha256,
};
