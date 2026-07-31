const {
  buildSimpleStockBackfillManifest,
} = require('../manifest/simpleStockBackfillManifest');

const APPROVAL_DRY_RUN_VERSION = 'simple-stock-backfill-approval-dry-run-v1';

const createValidationError = (code, message, details = null) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
};

const validateRequiredText = (value, code, label) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw createValidationError(code, `${label} is required`);
  }
  return normalized;
};

const validateSimpleStockBackfillApprovalDryRun = ({
  branchId,
  manifestId,
  sourceSnapshotHash,
  operatorIdentity,
  balances,
  lots,
  movements,
}) => {
  const normalizedManifestId = validateRequiredText(
    manifestId,
    'SIMPLE_STOCK_BACKFILL_MANIFEST_ID_REQUIRED',
    'manifestId'
  );
  const normalizedSnapshotHash = validateRequiredText(
    sourceSnapshotHash,
    'SIMPLE_STOCK_BACKFILL_SNAPSHOT_HASH_REQUIRED',
    'sourceSnapshotHash'
  );
  const normalizedOperatorIdentity = validateRequiredText(
    operatorIdentity,
    'SIMPLE_STOCK_BACKFILL_OPERATOR_REQUIRED',
    'operatorIdentity'
  );

  const currentManifest = buildSimpleStockBackfillManifest({
    branchId,
    balances,
    lots,
    movements,
  });

  const staleReasons = [];
  if (currentManifest.manifestId !== normalizedManifestId) {
    staleReasons.push({
      code: 'MANIFEST_ID_MISMATCH',
      expected: normalizedManifestId,
      actual: currentManifest.manifestId,
    });
  }
  if (currentManifest.sourceSnapshotHash !== normalizedSnapshotHash) {
    staleReasons.push({
      code: 'SOURCE_SNAPSHOT_HASH_MISMATCH',
      expected: normalizedSnapshotHash,
      actual: currentManifest.sourceSnapshotHash,
    });
  }

  const blockedEntries = currentManifest.entries.filter(
    (entry) => entry.classification !== 'READY_FOR_APPROVAL'
  );
  const readyEntries = currentManifest.entries.filter(
    (entry) => entry.classification === 'READY_FOR_APPROVAL'
  );

  const stale = staleReasons.length > 0;
  const executable = false;
  const approvedForMutation = false;

  return {
    validationVersion: APPROVAL_DRY_RUN_VERSION,
    mode: 'DRY_RUN_ONLY',
    mutationPerformed: false,
    executable,
    approvedForMutation,
    operatorIdentity: normalizedOperatorIdentity,
    branchId: currentManifest.branchId,
    submittedApproval: {
      manifestId: normalizedManifestId,
      sourceSnapshotHash: normalizedSnapshotHash,
    },
    currentManifest: {
      manifestId: currentManifest.manifestId,
      sourceSnapshotHash: currentManifest.sourceSnapshotHash,
    },
    validation: {
      stale,
      staleDataMustAbort: true,
      staleReasons,
      readyEntryCount: readyEntries.length,
      blockedEntryCount: blockedEntries.length,
      allEntriesReady: blockedEntries.length === 0,
      result: stale ? 'REJECTED_STALE_DATA' : 'VALIDATED_DRY_RUN_ONLY',
    },
    readyEntries: readyEntries.map((entry) => ({
      entryId: entry.entryId,
      preconditionHash: entry.preconditionHash,
      proposedLot: entry.proposedLot,
    })),
    blockedEntries: blockedEntries.map((entry) => ({
      entryId: entry.entryId,
      classification: entry.classification,
      reasonCode: entry.reasonCode,
      preconditionHash: entry.preconditionHash,
    })),
    safetyContract: {
      noDatabaseMutation: true,
      noSimpleLotCreate: true,
      noStockMovementCreate: true,
      noStockBalanceUpdate: true,
      executionRequiresSeparateApprovedIncrement: true,
    },
  };
};

module.exports = {
  APPROVAL_DRY_RUN_VERSION,
  validateSimpleStockBackfillApprovalDryRun,
};
