const { prisma } = require('../../../../../lib/prisma')

class SimpleStockAdjustmentRepository {
  constructor(client = prisma) {
    this.prisma = client
  }

  transaction(work) {
    return this.prisma.$transaction(
      (tx) => work(new SimpleStockAdjustmentRepository(tx)),
      { isolationLevel: 'Serializable', timeout: 20000, maxWait: 8000 }
    )
  }

  findProduct(branchId, productId) {
    return this.prisma.product.findFirst({
      where: {
        id: Number(productId),
        active: true,
        productType: { branchId: Number(branchId) },
      },
      select: {
        id: true,
        name: true,
        mode: true,
        noSN: true,
        trackSerialNumber: true,
        inventoryBehavior: true,
      },
    })
  }

  findBalance(branchId, productId) {
    return this.prisma.stockBalance.findUnique({
      where: {
        productId_branchId: {
          productId: Number(productId),
          branchId: Number(branchId),
        },
      },
    })
  }

  findActiveLots(branchId, productId) {
    return this.prisma.simpleLot.findMany({
      where: {
        branchId: Number(branchId),
        productId: Number(productId),
        status: 'ACTIVE',
        qtyRemaining: { gt: 0 },
      },
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
    })
  }

  createAdjustmentLot(data) {
    return this.prisma.simpleLot.create({ data })
  }

  updateLot(id, qtyRemaining) {
    return this.prisma.simpleLot.update({
      where: { id: Number(id) },
      data: {
        qtyRemaining,
        status: qtyRemaining.isZero() ? 'CLOSED' : 'ACTIVE',
      },
    })
  }

  upsertBalance({ branchId, productId, quantity, reserved, avgCost, lastReceivedCost }) {
    return this.prisma.stockBalance.upsert({
      where: {
        productId_branchId: {
          productId: Number(productId),
          branchId: Number(branchId),
        },
      },
      update: { quantity, reserved, avgCost, lastReceivedCost },
      create: {
        productId: Number(productId),
        branchId: Number(branchId),
        quantity,
        reserved,
        avgCost,
        lastReceivedCost,
      },
    })
  }

  createMovement(data) {
    return this.prisma.stockMovement.create({ data })
  }
}

module.exports = new SimpleStockAdjustmentRepository()
module.exports.SimpleStockAdjustmentRepository = SimpleStockAdjustmentRepository
