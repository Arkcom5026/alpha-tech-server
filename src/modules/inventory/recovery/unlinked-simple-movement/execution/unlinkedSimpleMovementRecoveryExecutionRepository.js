const { prisma } = require('../../../../../../lib/prisma');
const {
  buildUnlinkedSimpleMovementRecoveryManifest,
} = require('../manifest/buildUnlinkedSimpleMovementRecoveryManifest');
const {
  validateUnlinkedSimpleMovementRecoveryApprovalDryRun,
} = require('../approval/validateUnlinkedSimpleMovementRecoveryApprovalDryRun');
const {
  buildUnlinkedSimpleMovementRecoveryExecutionPlan,
} = require('../execution-plan/buildUnlinkedSimpleMovementRecoveryExecutionPlan');

class UnlinkedSimpleMovementRecoveryExecutionRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  transaction(work) {
    return this.prisma.$transaction(
      (tx) => work(new UnlinkedSimpleMovementRecoveryExecutionRepository(tx)),
      { isolationLevel: 'Serializable', timeout: 30000, maxWait: 10000 }
    );
  }

  async loadSnapshot(branchId) {
    const [balances, lots, movements] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where: { branchId: Number(branchId) },
        select: {
          id: true,
          branchId: true,
          productId: true,
          quantity: true,
          reserved: true,
          avgCost: true,
          lastReceivedCost: true,
        },
        orderBy: [{ productId: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.simpleLot.findMany({
        where: { branchId: Number(branchId) },
        select: { id: true, branchId: true, productId: true },
        orderBy: [{ productId: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.stockMovement.findMany({
        where: { branchId: Number(branchId) },
        select: {
          id: true,
          branchId: true,
          productId: true,
          qty: true,
          type: true,
          refType: true,
          refId: true,
          simpleLotId: true,
          performedByEmployeeId: true,
          occurredAt: true,
          createdAt: true,
        },
        orderBy: [
          { productId: 'asc' },
          { occurredAt: 'asc' },
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
      }),
    ]);

    return { balances, lots, movements };
  }

  async revalidateExecutionPlan({ executionPlan, approval }) {
    const branchId = Number(approval.branchId);
    const snapshot = await this.loadSnapshot(branchId);
    const manifest = buildUnlinkedSimpleMovementRecoveryManifest({
      branchId,
      ...snapshot,
    });

    const manifestMatches =
      manifest.manifestId === approval.manifestId
      && manifest.sourceSnapshotHash === approval.sourceSnapshotHash;

    let currentPlan = null;
    if (manifestMatches) {
      const dryRunResult = validateUnlinkedSimpleMovementRecoveryApprovalDryRun({
        branchId,
        manifestId: manifest.manifestId,
        sourceSnapshotHash: manifest.sourceSnapshotHash,
        operatorIdentity: approval.operatorIdentity,
        ...snapshot,
      });
      currentPlan = buildUnlinkedSimpleMovementRecoveryExecutionPlan({ dryRunResult });
    }

    const entriesById = new Map(
      manifest.entries.map((entry) => [entry.entryId, entry])
    );
    const operationResults = (executionPlan.operations || []).map((operation) => {
      const current = entriesById.get(operation.entryId);
      const currentMovementIds = current?.proposedRecovery?.movementIdsToLink || [];
      const expectedMovementIds = operation.linkExistingMovementIds || [];
      const movementIdsMatch =
        currentMovementIds.length === expectedMovementIds.length
        && currentMovementIds.every(
          (movementId, index) => Number(movementId) === Number(expectedMovementIds[index])
        );

      return {
        entryId: operation.entryId,
        productId: operation.productId,
        expectedPreconditionHash: operation.preconditionHash,
        actualPreconditionHash: current?.preconditionHash || null,
        expectedMovementEvidenceHash: operation.movementEvidenceHash,
        actualMovementEvidenceHash:
          current?.preconditions?.movementEvidenceHash || null,
        classification: current?.classification || null,
        matches:
          current?.classification === 'SAFE_TO_LINK'
          && Number(current?.preconditions?.productId) === Number(operation.productId)
          && current?.preconditionHash === operation.preconditionHash
          && current?.preconditions?.movementEvidenceHash
            === operation.movementEvidenceHash
          && movementIdsMatch,
      };
    });

    return {
      manifestMatches,
      planMatches:
        currentPlan != null
        && currentPlan.executionPlanId === approval.executionPlanId
        && currentPlan.executionPlanHash === approval.executionPlanHash
        && executionPlan.executionPlanId === approval.executionPlanId
        && executionPlan.executionPlanHash === approval.executionPlanHash,
      currentManifestId: manifest.manifestId,
      currentSourceSnapshotHash: manifest.sourceSnapshotHash,
      currentExecutionPlanId: currentPlan?.executionPlanId || null,
      currentExecutionPlanHash: currentPlan?.executionPlanHash || null,
      operationResults,
    };
  }

  async revalidateOperation({ branchId, command }) {
    const snapshot = await this.loadSnapshot(branchId);
    const manifest = buildUnlinkedSimpleMovementRecoveryManifest({
      branchId,
      ...snapshot,
    });
    const entry = manifest.entries.find(
      (candidate) => candidate.entryId === command.entryId
    );

    return {
      manifest,
      entry,
      matches:
        entry?.classification === 'SAFE_TO_LINK'
        && Number(entry?.preconditions?.productId) === Number(command.productId)
        && entry?.preconditionHash === command.preconditionHash
        && entry?.preconditions?.movementEvidenceHash === command.movementEvidenceHash,
    };
  }

  createSimpleLot(data) {
    return this.prisma.simpleLot.create({ data });
  }

  linkExistingMovements({ movementIds, branchId, productId, simpleLotId }) {
    return this.prisma.stockMovement.updateMany({
      where: {
        id: { in: (movementIds || []).map(Number) },
        branchId: Number(branchId),
        productId: Number(productId),
        simpleLotId: null,
      },
      data: { simpleLotId: Number(simpleLotId) },
    });
  }

  linkStockMovement({ movementId, branchId, productId, simpleLotId }) {
    return this.linkExistingMovements({
      movementIds: [movementId],
      branchId,
      productId,
      simpleLotId,
    });
  }

  recordExecutionAudit(data) {
    return Promise.resolve({
      auditType: 'UNLINKED_SIMPLE_MOVEMENT_RECOVERY_EXECUTION',
      recordedAt: new Date().toISOString(),
      ...data,
    });
  }
}

module.exports = new UnlinkedSimpleMovementRecoveryExecutionRepository();
module.exports.UnlinkedSimpleMovementRecoveryExecutionRepository = UnlinkedSimpleMovementRecoveryExecutionRepository;
