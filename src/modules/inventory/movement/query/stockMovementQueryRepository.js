'use strict'

const { prisma } = require('../../../../../lib/prisma')

class StockMovementQueryRepository {
  constructor(client = prisma) {
    this.prisma = client
  }

  list({ branchId, productId, type, refType, refId, from, to, cursorId, limit }) {
    return this.prisma.stockMovement.findMany({
      where: {
        branchId: Number(branchId),
        ...(productId ? { productId: Number(productId) } : {}),
        ...(type ? { type } : {}),
        ...(refType ? { refType } : {}),
        ...(refId ? { refId: Number(refId) } : {}),
        ...(from || to
          ? {
              occurredAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
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
        stockItemId: true,
        previousStockStatus: true,
        resultingStockStatus: true,
        occurredAt: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            saleBarcode: true,
          },
        },
        performedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      ...(cursorId
        ? {
            cursor: { id: Number(cursorId) },
            skip: 1,
          }
        : {}),
      take: limit + 1,
    })
  }
}

module.exports = new StockMovementQueryRepository()
module.exports.StockMovementQueryRepository = StockMovementQueryRepository
