const { prisma } = require('../../../../../lib/prisma')

class SimpleStockTransferRepository {
  constructor(client = prisma) {
    this.prisma = client
  }

  transaction(work) {
    return this.prisma.$transaction(
      (tx) => work(new SimpleStockTransferRepository(tx)),
      { isolationLevel: 'Serializable', timeout: 20000, maxWait: 8000 }
    )
  }

  findBranch(branchId) {
    return this.prisma.branch.findUnique({
      where: { id: Number(branchId) },
      select: { id: true, name: true, branchCode: true },
    })
  }

  findSourceProduct(branchId, productId) {
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
        templateProductId: true,
      },
    })
  }

  findTargetProduct(branchId, sourceProduct, targetProductId) {
    const identity = sourceProduct.templateProductId || sourceProduct.id
    return this.prisma.product.findFirst({
      where: {
        active: true,
        productType: { branchId: Number(branchId) },
        ...(targetProductId
          ? { id: Number(targetProductId) }
          : {
              OR: [
                { templateProductId: Number(identity) },
                { id: Number(identity) },
              ],
            }),
      },
      select: {
        id: true,
        name: true,
        mode: true,
        noSN: true,
        trackSerialNumber: true,
        inventoryBehavior: true,
        templateProductId: true,
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

  findTransferMovements(refType) {
    return this.prisma.stockMovement.findMany({
      where: { type: 'TRANSFER', refType },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        productId: true,
        branchId: true,
        qty: true,
        simpleLotId: true,
      },
    })
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

  createDestinationLot(data) {
    return this.prisma.simpleLot.create({ data })
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

module.exports = new SimpleStockTransferRepository()
module.exports.SimpleStockTransferRepository = SimpleStockTransferRepository
