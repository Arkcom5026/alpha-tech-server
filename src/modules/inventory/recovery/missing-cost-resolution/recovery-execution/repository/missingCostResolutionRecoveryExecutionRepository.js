const prisma = require('../../../../../../../database/prisma/client');
const { sha256 } = require('../../contracts/missingCostResolutionContract');

const createError = (code, message, details = undefined) => {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
};

class MissingCostResolutionRecoveryExecutionRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  transaction(work) {
    return this.prisma.$transaction(
      (tx) => work(new MissingCostResolutionRecoveryExecutionRepository(tx)),
      { isolationLevel: 'Serializable' }
    );
  }

  async assertIdempotencyAvailable({ branchId, resolutionId, idempotencyKey, executionAuthorityHash }) {
    const duplicate = await this.prisma.missingCostResolutionEvent.findFirst({
      where: {
        resolutionId: Number(resolutionId),
        resolution: { branchId: Number(branchId) },
        eventType: 'RECOVERY_EXECUTED',
        eventHash: sha256({
          namespace: 'MISSING_COST_RECOVERY_EXECUTION',
          branchId: Number(branchId),
          resolutionId: Number(resolutionId),
          idempotencyKey: String(idempotencyKey),
          executionAuthorityHash: String(executionAuthorityHash),
        }),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw createError(
        'MISSING_COST_RECOVERY_DUPLICATE_EXECUTION',
        'This approved recovery plan has already been executed'
      );
    }
  }

  async revalidateExecutionAuthority({ authority }) {
    const resolution = await this.prisma.missingCostResolution.findFirst({
      where: {
        id: Number(authority.resolutionId),
        branchId: Number(authority.branchId),
        stockBalanceId: Number(authority.operations?.[0]?.stockBalanceId),
        productId: Number(authority.operations?.[0]?.productId),
        status: 'APPROVED',
        currentVersion: Number(authority.approvedVersion),
        sourceSnapshotHash: String(authority.sourceSnapshotHash),
      },
      include: {
        versions: {
          where: {
            version: Number(authority.approvedVersion),
            evidenceHash: String(authority.evidenceHash),
            approvedAt: { not: null },
          },
          take: 1,
        },
      },
    });

    if (!resolution || resolution.versions.length !== 1) {
      throw createError(
        'MISSING_COST_RECOVERY_STALE_RUNTIME_AUTHORITY',
        'Approved resolution authority no longer matches the execution plan'
      );
    }

    const operation = authority.operations?.[0];
    const stockBalance = await this.prisma.stockBalance.findFirst({
      where: {
        id: Number(operation.stockBalanceId),
        branchId: Number(authority.branchId),
        productId: Number(operation.productId),
      },
      select: {
        id: true,
        branchId: true,
        productId: true,
        quantity: true,
        avgCost: true,
        lastReceivedCost: true,
      },
    });

    if (!stockBalance || Number(stockBalance.quantity) !== Number(operation.expectedQuantity)) {
      throw createError(
        'MISSING_COST_RECOVERY_PRECONDITION_MISMATCH',
        'Current inventory quantity no longer matches the approved recovery plan'
      );
    }

    return { resolution, approvedVersion: resolution.versions[0], stockBalance };
  }

  async applyApprovedUnitCost({ authority, runtime }) {
    const operation = authority.operations[0];
    const updated = await this.prisma.stockBalance.updateMany({
      where: {
        id: Number(operation.stockBalanceId),
        branchId: Number(authority.branchId),
        productId: Number(operation.productId),
        quantity: Number(operation.expectedQuantity),
      },
      data: {
        avgCost: Number(operation.approvedUnitCost),
        lastReceivedCost: Number(operation.approvedUnitCost),
      },
    });

    if (updated.count !== 1) {
      throw createError(
        'MISSING_COST_RECOVERY_PRECONDITION_MISMATCH',
        'Inventory authority changed during controlled recovery execution'
      );
    }

    const eventHash = sha256({
      namespace: 'MISSING_COST_RECOVERY_EXECUTION',
      branchId: Number(authority.branchId),
      resolutionId: Number(authority.resolutionId),
      idempotencyKey: String(authority.idempotencyKey),
      executionAuthorityHash: String(authority.executionAuthorityHash),
    });

    const event = await this.prisma.missingCostResolutionEvent.create({
      data: {
        resolutionId: Number(authority.resolutionId),
        versionId: runtime.approvedVersion.id,
        eventType: 'RECOVERY_EXECUTED',
        previousStatus: 'APPROVED',
        resultingStatus: 'APPROVED',
        actorEmployeeId: null,
        reasonCode: 'APPROVED_COST_RECOVERY_EXECUTED',
        note: `executor=${authority.executorIdentity}; approver=${authority.approvalIdentity}`,
        evidenceHash: String(authority.evidenceHash),
        candidateSnapshotHash: String(authority.sourceSnapshotHash),
        eventHash,
      },
    });

    return {
      stockBalanceId: runtime.stockBalance.id,
      productId: runtime.stockBalance.productId,
      previousUnitCost: runtime.stockBalance.avgCost == null ? null : Number(runtime.stockBalance.avgCost),
      appliedUnitCost: Number(operation.approvedUnitCost),
      quantity: Number(runtime.stockBalance.quantity),
      resultingInventoryValue: Number(runtime.stockBalance.quantity) * Number(operation.approvedUnitCost),
      event,
    };
  }
}

module.exports = new MissingCostResolutionRecoveryExecutionRepository();
module.exports.MissingCostResolutionRecoveryExecutionRepository = MissingCostResolutionRecoveryExecutionRepository;
