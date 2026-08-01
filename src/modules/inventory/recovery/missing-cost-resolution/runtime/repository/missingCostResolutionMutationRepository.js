const prisma = require('../../../../../../database/prisma/client');
const { sha256 } = require('../../contracts/missingCostResolutionContract');
const {
  assertExpectedAuthority,
  assertSeparateApprover,
  assertTransitionEventType,
} = require('../policy/missingCostResolutionMutationPolicy');

class MissingCostResolutionMutationRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  createDraft({ branchId, stockBalanceId, productId, sourceAuditId, sourceSnapshotHash, candidateId, candidateIdentityHash, candidateEntryId, actorEmployeeId }) {
    const eventHash = sha256({
      eventType: 'CREATED',
      branchId,
      candidateId,
      actorEmployeeId,
      sourceSnapshotHash,
    });

    return this.prisma.$transaction(async (tx) => {
      const stockBalance = await tx.stockBalance.findFirst({
        where: {
          id: Number(stockBalanceId),
          branchId: Number(branchId),
          productId: Number(productId),
        },
        select: { id: true },
      });
      if (!stockBalance) return null;

      const resolution = await tx.missingCostResolution.create({
        data: {
          branchId: Number(branchId),
          stockBalanceId: Number(stockBalanceId),
          productId: Number(productId),
          sourceAuditId,
          sourceSnapshotHash,
          candidateId,
          candidateIdentityHash,
          candidateEntryId,
          status: 'DRAFT',
          currentVersion: 1,
          createdByEmployeeId: Number(actorEmployeeId),
        },
      });

      await tx.missingCostResolutionEvent.create({
        data: {
          resolutionId: resolution.id,
          eventType: 'CREATED',
          previousStatus: null,
          resultingStatus: 'DRAFT',
          actorEmployeeId: Number(actorEmployeeId),
          reasonCode: 'MISSING_COST_DRAFT_CREATED',
          evidenceHash: null,
          candidateSnapshotHash: sourceSnapshotHash,
          eventHash,
        },
      });

      return resolution;
    });
  }

  appendEvidenceVersion({ branchId, resolutionId, expectedStatus, expectedVersion, expectedSnapshotHash, actorEmployeeId, sourceType, sourceReference, evidenceSummary, proposedUnitCost, effectiveDate, confidence, rationale, evidenceHash }) {
    return this.prisma.$transaction(async (tx) => {
      const resolution = await tx.missingCostResolution.findFirst({
        where: { id: Number(resolutionId), branchId: Number(branchId) },
      });
      assertExpectedAuthority({ resolution, branchId, expectedStatus, expectedVersion, expectedSnapshotHash });

      const nextVersion = Number(resolution.currentVersion) + 1;
      const version = await tx.missingCostResolutionVersion.create({
        data: {
          resolutionId: resolution.id,
          version: nextVersion,
          sourceType,
          sourceReference,
          evidenceSummary,
          proposedUnitCost,
          effectiveDate: new Date(effectiveDate),
          confidence,
          rationale,
          proposerEmployeeId: Number(actorEmployeeId),
          evidenceHash,
          candidateSnapshotHash: resolution.sourceSnapshotHash,
        },
      });

      const updated = await tx.missingCostResolution.updateMany({
        where: {
          id: resolution.id,
          branchId: Number(branchId),
          status: resolution.status,
          currentVersion: Number(expectedVersion),
        },
        data: { currentVersion: nextVersion },
      });
      if (updated.count !== 1) {
        const error = new Error('Missing cost resolution version is stale');
        error.code = 'MISSING_COST_RESOLUTION_STALE_VERSION';
        error.statusCode = 409;
        throw error;
      }

      const eventHash = sha256({
        eventType: 'EVIDENCE_VERSION_CREATED',
        resolutionId: resolution.id,
        versionId: version.id,
        evidenceHash,
        actorEmployeeId,
      });
      await tx.missingCostResolutionEvent.create({
        data: {
          resolutionId: resolution.id,
          versionId: version.id,
          eventType: 'EVIDENCE_VERSION_CREATED',
          previousStatus: resolution.status,
          resultingStatus: resolution.status,
          actorEmployeeId: Number(actorEmployeeId),
          reasonCode: 'MISSING_COST_EVIDENCE_VERSION_CREATED',
          evidenceHash,
          candidateSnapshotHash: resolution.sourceSnapshotHash,
          eventHash,
        },
      });

      return { resolutionId: resolution.id, currentVersion: nextVersion, version };
    });
  }

  transition({ branchId, resolutionId, actorEmployeeId, expectedStatus, expectedVersion, expectedSnapshotHash, expectedEvidenceHash, toStatus, reasonCode, note = null, approvalSnapshot = null }) {
    return this.prisma.$transaction(async (tx) => {
      const resolution = await tx.missingCostResolution.findFirst({
        where: { id: Number(resolutionId), branchId: Number(branchId) },
        include: { versions: { orderBy: [{ version: 'desc' }], take: 1 } },
      });
      assertExpectedAuthority({ resolution, branchId, expectedStatus, expectedVersion, expectedSnapshotHash });
      assertSeparateApprover({ resolution, actorEmployeeId, toStatus });
      const latestVersion = resolution.versions[0] || null;
      if (expectedEvidenceHash && latestVersion?.evidenceHash !== expectedEvidenceHash) {
        const error = new Error('Missing cost resolution evidence is stale');
        error.code = 'MISSING_COST_RESOLUTION_STALE_EVIDENCE';
        error.statusCode = 409;
        throw error;
      }

      const eventType = assertTransitionEventType(toStatus);
      const now = new Date();
      const updated = await tx.missingCostResolution.updateMany({
        where: {
          id: resolution.id,
          branchId: Number(branchId),
          status: String(expectedStatus),
          currentVersion: Number(expectedVersion),
        },
        data: {
          status: toStatus,
          ...(toStatus === 'APPROVED' ? {
            approvedByEmployeeId: Number(actorEmployeeId),
            approvedAt: now,
          } : {}),
        },
      });
      if (updated.count !== 1) {
        const error = new Error('Missing cost resolution authority is stale');
        error.code = 'MISSING_COST_RESOLUTION_STALE_AUTHORITY';
        error.statusCode = 409;
        throw error;
      }

      if (latestVersion && toStatus === 'SUBMITTED') {
        await tx.missingCostResolutionVersion.update({
          where: { id: latestVersion.id },
          data: { submittedAt: now },
        });
      }
      if (latestVersion && toStatus === 'APPROVED') {
        await tx.missingCostResolutionVersion.update({
          where: { id: latestVersion.id },
          data: {
            approvedAt: now,
            approvedByEmployeeId: Number(actorEmployeeId),
            approvalSnapshot,
          },
        });
      }

      const eventHash = sha256({
        resolutionId: resolution.id,
        eventType,
        previousStatus: resolution.status,
        resultingStatus: toStatus,
        actorEmployeeId,
        reasonCode,
        evidenceHash: latestVersion?.evidenceHash || null,
        expectedVersion,
      });
      const event = await tx.missingCostResolutionEvent.create({
        data: {
          resolutionId: resolution.id,
          versionId: latestVersion?.id || null,
          eventType,
          previousStatus: resolution.status,
          resultingStatus: toStatus,
          actorEmployeeId: Number(actorEmployeeId),
          reasonCode,
          note,
          evidenceHash: latestVersion?.evidenceHash || null,
          candidateSnapshotHash: resolution.sourceSnapshotHash,
          eventHash,
          occurredAt: now,
        },
      });

      return {
        resolutionId: resolution.id,
        previousStatus: resolution.status,
        status: toStatus,
        currentVersion: resolution.currentVersion,
        event,
      };
    });
  }
}

module.exports = new MissingCostResolutionMutationRepository();
module.exports.MissingCostResolutionMutationRepository = MissingCostResolutionMutationRepository;
