'use strict';

const { prisma } = require('../../../lib/prisma');
const repository = require('./taxClosingFinalizationRepository');
const { buildIntegrity } = require('./taxClosingFinalizationIntegrity');
const handoffService = require('../handoff/taxClosingHandoffService');

const fail = (code, message, statusCode = 400, details) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (details) error.details = details;
  throw error;
};

const requireExpectedSnapshotHash = (value) => {
  const snapshotHash = String(value || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(snapshotHash)) {
    fail(
      'TAX_CLOSING_FINALIZATION_EXPECTED_SNAPSHOT_REQUIRED',
      'expectedSnapshotHash must be a SHA-256 hash from the reviewed Tax Closing Package',
      400,
    );
  }
  return snapshotHash;
};

const loadIntegrity = async ({ branchId, taxPeriodId, currentSnapshotHash }, tx = prisma) => {
  const finalization = await repository.findLatest({ branchId, taxPeriodId }, tx);
  return buildIntegrity({ currentSnapshotHash, finalization });
};

const finalizeCurrentPackage = async ({ branchId, taxPeriodId, finalizedById, expectedSnapshotHash }) => {
  const reviewedSnapshotHash = requireExpectedSnapshotHash(expectedSnapshotHash);
  const bundle = await handoffService.loadTaxClosingHandoffBundle({ branchId, taxPeriodId, includeFinalizationIntegrity: false });
  if (!bundle.handoffReady) {
    fail(
      'TAX_CLOSING_FINALIZATION_NOT_READY',
      'Tax closing package must be ready before finalization',
      409,
      { packageStatus: bundle.packageStatus, blockerCount: bundle.snapshot?.readiness?.summary?.blockerCount || 0 },
    );
  }
  if (bundle.snapshotHash !== reviewedSnapshotHash) {
    fail(
      'TAX_CLOSING_FINALIZATION_SNAPSHOT_CHANGED',
      'Tax closing package changed after it was reviewed; reload and review the current snapshot before finalizing',
      409,
      {
        expectedSnapshotHash: reviewedSnapshotHash,
        currentSnapshotHash: bundle.snapshotHash,
      },
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const latest = await repository.findLatest({ branchId, taxPeriodId }, tx);
      if (latest?.snapshotHash === bundle.snapshotHash) {
        return Object.freeze({
          replayed: true,
          finalization: latest,
          integrity: buildIntegrity({ currentSnapshotHash: bundle.snapshotHash, finalization: latest }),
        });
      }

      const nextVersion = Number(latest?.version || 0) + 1;
      const finalization = await repository.insertVersion({
        branchId,
        taxPeriodId,
        version: nextVersion,
        packageVersion: bundle.packageVersion,
        snapshotHash: bundle.snapshotHash,
        snapshot: bundle.snapshot,
        manifest: bundle.manifest,
        finalizedById,
      }, tx);

      return Object.freeze({
        replayed: false,
        finalization,
        integrity: buildIntegrity({ currentSnapshotHash: bundle.snapshotHash, finalization }),
      });
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error?.code === 'P2034' || error?.code === 'P2002') {
      fail('TAX_CLOSING_FINALIZATION_CONFLICT', 'Tax closing package changed while finalization was being recorded', 409);
    }
    throw error;
  }
};

module.exports = Object.freeze({
  buildIntegrity,
  loadIntegrity,
  finalizeCurrentPackage,
  requireExpectedSnapshotHash,
});
