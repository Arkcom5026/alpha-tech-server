const prisma = require('../../../../../../database/prisma/client');
const { sha256 } = require('../../contracts/missingCostResolutionContract');

const approvedResolutionInclude = {
  versions: {
    where: { approvedAt: { not: null } },
    orderBy: [{ version: 'desc' }, { approvedAt: 'desc' }],
    take: 1,
  },
};

class MissingCostResolutionRecoveryPreviewRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findApprovedResolution({ branchId, resolutionId }) {
    return this.prisma.missingCostResolution.findFirst({
      where: {
        id: Number(resolutionId),
        branchId: Number(branchId),
        status: 'APPROVED',
      },
      include: approvedResolutionInclude,
    });
  }

  async findCurrentSource({ branchId, stockBalanceId, productId }) {
    const stockBalance = await this.prisma.stockBalance.findFirst({
      where: {
        id: Number(stockBalanceId),
        branchId: Number(branchId),
        productId: Number(productId),
      },
      select: {
        id: true,
        branchId: true,
        productId: true,
        quantity: true,
        avgCost: true,
        lastReceivedCost: true,
        updatedAt: true,
      },
    });
    if (!stockBalance) return null;

    const sourceAuthority = {
      branchId: stockBalance.branchId,
      stockBalanceId: stockBalance.id,
      productId: stockBalance.productId,
      quantity: Number(stockBalance.quantity || 0),
      avgCost: stockBalance.avgCost == null ? null : Number(stockBalance.avgCost),
      lastReceivedCost: stockBalance.lastReceivedCost == null
        ? null
        : Number(stockBalance.lastReceivedCost),
      updatedAt: stockBalance.updatedAt instanceof Date
        ? stockBalance.updatedAt.toISOString()
        : String(stockBalance.updatedAt || ''),
    };

    return {
      branchId: sourceAuthority.branchId,
      stockBalanceId: sourceAuthority.stockBalanceId,
      productId: sourceAuthority.productId,
      quantity: sourceAuthority.quantity,
      currentUnitCost: sourceAuthority.avgCost ?? sourceAuthority.lastReceivedCost,
      sourceSnapshotHash: sha256(sourceAuthority),
      sourceAuthority,
    };
  }
}

module.exports = new MissingCostResolutionRecoveryPreviewRepository();
module.exports.MissingCostResolutionRecoveryPreviewRepository = MissingCostResolutionRecoveryPreviewRepository;
module.exports.approvedResolutionInclude = approvedResolutionInclude;
