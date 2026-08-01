const { prisma } = require('../../../../../../lib/prisma');
const {
  buildUnlinkedSimpleMovementRecoveryManifest,
} = require('../manifest/buildUnlinkedSimpleMovementRecoveryManifest');

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

  async revalidateOperation({ branchId, command }) {
    const snapshot = await this.loadSnapshot(branchId);
    const manifest = buildUnlinkedSimpleMovementRecoveryManifest({
      branchId,
      ...snapshot,
    });
    const entry = manifest.entries.find((candidate) => candidate.entryId === command.entryId);

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

  linkStockMovement({ movementId, branchId, productId, simpleLotId }) {
    return this.prisma.stockMovement.updateMany({
      where: {
        id: Number(movementId),
        branchId: Number(branchId),
        productId: Number(productId),
        simpleLotId: null,
      },
      data: { simpleLotId: Number(simpleLotId) },
    });
  }
}

module.exports = new UnlinkedSimpleMovementRecoveryExecutionRepository();
module.exports.UnlinkedSimpleMovementRecoveryExecutionRepository = UnlinkedSimpleMovementRecoveryExecutionRepository;
