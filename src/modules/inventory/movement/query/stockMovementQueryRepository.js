'use strict'

const { prisma } = require('../../../../../lib/prisma')

class StockMovementQueryRepository {
  constructor(client = prisma) {
    this.prisma = client
  }

  list({
    branchId,
    productId,
    stockItemId,
    simpleLotId,
    type,
    direction,
    refType,
    refId,
    barcode,
    serialNumber,
    from,
    to,
    cursor,
    limit,
  }) {
    const where = {
      branchId: Number(branchId),
      ...(productId ? { productId: Number(productId) } : {}),
      ...(stockItemId ? { stockItemId: Number(stockItemId) } : {}),
      ...(simpleLotId ? { simpleLotId: Number(simpleLotId) } : {}),
      ...(type ? { type } : {}),
      ...(direction === 'IN' ? { qty: { gt: 0 } } : {}),
      ...(direction === 'OUT' ? { qty: { lt: 0 } } : {}),
      ...(refType ? { refType } : {}),
      ...(refId ? { refId: Number(refId) } : {}),
      ...(barcode || serialNumber
        ? {
            stockItem: {
              ...(barcode ? { barcode } : {}),
              ...(serialNumber ? { serialNumber } : {}),
            },
          }
        : {}),
      ...(from || to
        ? {
            occurredAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    }

    if (cursor) {
      where.AND = [
        {
          OR: [
            { occurredAt: { lt: cursor.occurredAt } },
            {
              occurredAt: cursor.occurredAt,
              id: { lt: Number(cursor.id) },
            },
          ],
        },
      ]
    }

    return this.prisma.stockMovement.findMany({
      where,
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
        stockItem: {
          select: {
            id: true,
            barcode: true,
            serialNumber: true,
            status: true,
            receivedAt: true,
            soldAt: true,
            warrantyDays: true,
            expiredAt: true,
            batchNumber: true,
            locationCode: true,
            costPrice: true,
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
      take: limit + 1,
    })
  }
}

module.exports = new StockMovementQueryRepository()
module.exports.StockMovementQueryRepository = StockMovementQueryRepository
