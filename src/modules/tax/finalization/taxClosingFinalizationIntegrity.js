'use strict';

const buildIntegrity = ({ currentSnapshotHash, finalization }) => Object.freeze({
  status: !finalization
    ? 'NOT_FINALIZED'
    : (finalization.snapshotHash === currentSnapshotHash ? 'CURRENT' : 'STALE'),
  currentSnapshotHash,
  finalizedSnapshotHash: finalization?.snapshotHash || null,
  finalizationVersion: finalization?.version || null,
  packageVersion: finalization?.packageVersion || null,
  finalizedAt: finalization?.finalizedAt || null,
  finalizedById: finalization?.finalizedById ?? null,
  requiresRefinalization: Boolean(finalization && finalization.snapshotHash !== currentSnapshotHash),
});

module.exports = Object.freeze({ buildIntegrity });
