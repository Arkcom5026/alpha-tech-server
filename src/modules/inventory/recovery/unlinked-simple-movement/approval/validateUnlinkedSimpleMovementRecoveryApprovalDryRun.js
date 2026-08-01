const {
  buildUnlinkedSimpleMovementRecoveryManifest,
} = require('../manifest/buildUnlinkedSimpleMovementRecoveryManifest');

const requireText = (value, field) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    const error = new Error(`${field} is required`);
    error.code = 'UNLINKED_SIMPLE_MOVEMENT_APPROVAL_INPUT_REQUIRED';
    error.details = { field };
    throw error;
  }
  return normalized;
};

const validateUnlinkedSimpleMovementRecoveryApprovalDryRun = ({
  branchId,
  manifestId,
  sourceSnapshotHash,
  operatorIdentity,
  balances,
  lots,
  movements,
}) => {
  const approvedManifestId = requireText(manifestId, 'manifestId');
  const approvedSnapshotHash = requireText(sourceSnapshotHash, 'sourceSnapshotHash');
  const approvedOperator = requireText(operatorIdentity, 'operatorIdentity');

  const manifest = buildUnlinkedSimpleMovementRecoveryManifest({
    branchId,
    balances,
    lots,
    movements,
  });

  const staleReasons = [];
  if (manifest.manifestId !== approvedManifestId) {
    staleReasons.push({
      code: 'MANIFEST_ID_MISMATCH',
      expected: approvedManifestId,
      actual: manifest.manifestId,
    });
  }
  if (manifest.sourceSnapshotHash !== approvedSnapshotHash) {
    staleReasons.push({
      code: 'SOURCE_SNAPSHOT_HASH_MISMATCH',
      expected: approvedSnapshotHash,
      actual: manifest.sourceSnapshotHash,
    });
  }

  const readyEntries = manifest.entries.filter(
    (entry) => entry.classification === 'SAFE_TO_LINK'
  );
  const blockedEntries = manifest.entries.filter(
    (entry) => entry.classification !== 'SAFE_TO_LINK'
  );
  const stale = staleReasons.length > 0;

  return {
    validation: {
      result: stale ? 'REJECTED_STALE_DATA' : 'VALIDATED_DRY_RUN_ONLY',
      stale,
      staleReasons,
      readyEntryCount: readyEntries.length,
      blockedEntryCount: blockedEntries.length,
      operatorIdentity: approvedOperator,
      mutationPerformed: false,
    },
    authority: {
      branchId: Number(branchId),
      manifestId: manifest.manifestId,
      sourceSnapshotHash: manifest.sourceSnapshotHash,
    },
    readyEntries,
    blockedEntries,
    manifest,
  };
};

module.exports = {
  validateUnlinkedSimpleMovementRecoveryApprovalDryRun,
};
