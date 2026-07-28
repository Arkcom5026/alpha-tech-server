'use strict'

const { prisma } = require('../../../../../lib/prisma')

class StockMovementQueryRepository {
  constructor(client = prisma) {
    this.prisma = client
  }

  list({ branchId, productId, type, refType, refId, limit }) {
    return this.prisma.stockMovement.findMany({
      where: {
        branchId: Number(branchId),
        ...(productId ? { productId: Number(productId) } : {}),
        ...(type ? { type } : {}),
        ...(refType ? { refType } : {}),
        ...(refId ? { refId: String(refId) } : {}),
      },
      select: {
        id: true,
        productId: true,
        branchId: true,
        type: true,
        qty: true,
        refType: true,
        refId: true,
        note: true,
        performedByEmployeeId: true,
        simpleLotId: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })
  }
}

module.exports = new StockMovementQueryRepository()
module.exports.StockMovementQueryRepository = StockMovementQueryRepository
