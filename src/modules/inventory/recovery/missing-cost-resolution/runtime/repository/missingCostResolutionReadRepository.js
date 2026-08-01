const prisma = require('../../../../../../../database/prisma/client');

const resolutionInclude = {
  product: { select: { id: true, name: true, sku: true } },
  stockBalance: {
    select: {
      id: true,
      branchId: true,
      productId: true,
      quantity: true,
      avgCost: true,
      lastReceivedCost: true,
    },
  },
  versions: {
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
  },
  events: {
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
  },
};

class MissingCostResolutionReadRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findQueue({ branchId, status, productId, stockBalanceId, limit = 100, offset = 0 }) {
    return this.prisma.missingCostResolution.findMany({
      where: {
        branchId: Number(branchId),
        ...(status ? { status } : {}),
        ...(productId ? { productId: Number(productId) } : {}),
        ...(stockBalanceId ? { stockBalanceId: Number(stockBalanceId) } : {}),
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        stockBalance: {
          select: {
            id: true,
            branchId: true,
            productId: true,
            quantity: true,
            avgCost: true,
            lastReceivedCost: true,
          },
        },
        versions: {
          orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(Number(limit) || 100, 1), 200),
      skip: Math.max(Number(offset) || 0, 0),
    });
  }

  findDetail({ branchId, resolutionId }) {
    return this.prisma.missingCostResolution.findFirst({
      where: {
        id: Number(resolutionId),
        branchId: Number(branchId),
      },
      include: resolutionInclude,
    });
  }

  findAuditHistory({ branchId, resolutionId }) {
    return this.prisma.missingCostResolutionEvent.findMany({
      where: {
        resolutionId: Number(resolutionId),
        resolution: { branchId: Number(branchId) },
      },
      include: {
        version: true,
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
  }
}

module.exports = new MissingCostResolutionReadRepository();
module.exports.MissingCostResolutionReadRepository = MissingCostResolutionReadRepository;
module.exports.resolutionInclude = resolutionInclude;
