const crypto = require('crypto');
const {
  buildUnlinkedSimpleMovementRecoveryManifest,
} = require('../manifest/buildUnlinkedSimpleMovementRecoveryManifest');

const AUDIT_VERSION = 'post-recovery-simple-inventory-audit-v1';

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

const buildPostRecoverySimpleInventoryAudit = ({
  branchId,
  balances,
  lots,
  movements,
  baseline = {
    reconciliationCount: 75,
    missingCostCount: 32,
    completedSafeToLinkCount: 265,
  },
}) => {
  const normalizedBranchId = Number(branchId);
  if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
    const error = new Error('A positive branchId is required');
    error.code = 'INVENTORY_BRANCH_SCOPE_REQUIRED';
    throw error;
  }

  const scopedBalances = (balances || [])
    .filter((row) => Number(row.branchId) === normalizedBranchId)
    .map((row) => ({
      id: Number(row.id),
      branchId: Number(row.branchId),
      productId: Number(row.productId),
    }))
    .sort((a, b) => a.productId - b.productId || a.id - b.id);

  const scopedLots = (lots || [])
    .filter((row) => Number(row.branchId) === normalizedBranchId)
    .map((row) => ({
      id: Number(row.id),
      branchId: Number(row.branchId),
      productId: Number(row.productId),
    }))
    .sort((a, b) => a.productId - b.productId || a.id - b.id);

  const lotsByProduct = new Map();
  for (const lot of scopedLots) {
    const current = lotsByProduct.get(lot.productId) || [];
    current.push(lot.id);
    lotsByProduct.set(lot.productId, current);
  }

  const excludedBecauseLotExists = scopedBalances
    .filter((balance) => lotsByProduct.has(balance.productId))
    .map((balance) => ({
      stockBalanceId: balance.id,
      productId: balance.productId,
      simpleLotIds: [...lotsByProduct.get(balance.productId)].sort((a, b) => a - b),
      reasonCode: 'EXCLUDED_EXISTING_SIMPLE_LOT',
    }));

  const manifest = buildUnlinkedSimpleMovementRecoveryManifest({
    branchId: normalizedBranchId,
    balances,
    lots,
    movements,
  });

  const reconciliationEntries = manifest.entries.filter(
    (entry) => entry.classification === 'REQUIRES_MOVEMENT_RECONCILIATION'
  );
  const missingCostEntries = manifest.entries.filter(
    (entry) => entry.classification === 'BLOCKED_MISSING_COST'
  );
  const safeToLinkEntries = manifest.entries.filter(
    (entry) => entry.classification === 'SAFE_TO_LINK'
  );

  const summary = {
    branchId: normalizedBranchId,
    scopedBalanceCount: scopedBalances.length,
    scopedLotCount: scopedLots.length,
    excludedBecauseLotExistsCount: excludedBecauseLotExists.length,
    reconciliationCount: reconciliationEntries.length,
    missingCostCount: missingCostEntries.length,
    unexpectedSafeToLinkCount: safeToLinkEntries.length,
    unresolvedCandidateCount: reconciliationEntries.length + missingCostEntries.length,
  };

  const baselineComparison = {
    expected: {
      reconciliationCount: Number(baseline.reconciliationCount),
      missingCostCount: Number(baseline.missingCostCount),
      completedSafeToLinkCount: Number(baseline.completedSafeToLinkCount),
    },
    actual: {
      reconciliationCount: summary.reconciliationCount,
      missingCostCount: summary.missingCostCount,
      excludedBecauseLotExistsCount: summary.excludedBecauseLotExistsCount,
      unexpectedSafeToLinkCount: summary.unexpectedSafeToLinkCount,
    },
  };
  baselineComparison.drift = {
    reconciliationCount:
      baselineComparison.actual.reconciliationCount
      - baselineComparison.expected.reconciliationCount,
    missingCostCount:
      baselineComparison.actual.missingCostCount
      - baselineComparison.expected.missingCostCount,
    completedSafeToLinkCount:
      baselineComparison.actual.excludedBecauseLotExistsCount
      - baselineComparison.expected.completedSafeToLinkCount,
  };
  baselineComparison.matches = Object.values(baselineComparison.drift)
    .every((value) => value === 0)
    && baselineComparison.actual.unexpectedSafeToLinkCount === 0;

  const sourceSnapshot = {
    auditVersion: AUDIT_VERSION,
    branchId: normalizedBranchId,
    manifestId: manifest.manifestId,
    manifestSourceSnapshotHash: manifest.sourceSnapshotHash,
    excludedBecauseLotExists,
    reconciliationEntryIds: reconciliationEntries.map((entry) => entry.entryId),
    missingCostEntryIds: missingCostEntries.map((entry) => entry.entryId),
    unexpectedSafeToLinkEntryIds: safeToLinkEntries.map((entry) => entry.entryId),
    summary,
    baselineComparison,
  };
  const sourceSnapshotHash = sha256(sourceSnapshot);

  return {
    auditVersion: AUDIT_VERSION,
    auditId: `post-usmr-${normalizedBranchId}-${sourceSnapshotHash.slice(0, 24)}`,
    sourceSnapshotHash,
    branchId: normalizedBranchId,
    mode: 'POST_RECOVERY_AUDIT_PREVIEW_ONLY',
    mutationPerformed: false,
    manifest,
    summary,
    baselineComparison,
    excludedBecauseLotExists,
    reconciliationEntries,
    missingCostEntries,
    unexpectedSafeToLinkEntries: safeToLinkEntries,
    safetyContract: {
      executable: false,
      databaseMutationAllowed: false,
      completedRecordsMustNotBeProposedAgain: true,
      staleDataMustBeVisibleThroughSnapshotHash: true,
    },
  };
};

module.exports = {
  AUDIT_VERSION,
  buildPostRecoverySimpleInventoryAudit,
  sha256,
};
