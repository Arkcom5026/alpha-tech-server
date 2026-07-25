const { prisma } = require('../../../../../lib/prisma')

const findProductModeById = ({ productId, db = prisma }) => (
  db.product.findUnique({
    where: { id: Number(productId) },
    select: { id: true, mode: true },
  })
)

const groupInStockItemsByBranch = ({ productId, db = prisma }) => (
  db.stockItem.groupBy({
    by: ['branchId'],
    where: { productId: Number(productId), status: 'IN_STOCK' },
    _count: { _all: true },
  })
)

const migrateStructuredProductToSimple = ({ productId, groups, db = prisma }) => (
  db.$transaction(async (tx) => {
    let migratedQty = 0

    for (const group of groups) {
      const qty = group._count?._all ?? 0
      if (!qty) continue

      migratedQty += qty

      await tx.stockBalance.upsert({
        where: {
          productId_branchId: {
            productId: Number(productId),
            branchId: Number(group.branchId),
          },
        },
        update: { quantity: { increment: qty } },
        create: {
          productId: Number(productId),
          branchId: Number(group.branchId),
          quantity: qty,
          reserved: 0,
        },
      })

      await tx.stockItem.updateMany({
        where: {
          productId: Number(productId),
          branchId: Number(group.branchId),
          status: 'IN_STOCK',
        },
        data: { status: 'USED' },
      })
    }

    await tx.product.update({
      where: { id: Number(productId) },
      data: {
        mode: 'SIMPLE',
        noSN: true,
        trackSerialNumber: false,
      },
    })

    return { migratedQty }
  })
)

module.exports = {
  findProductModeById,
  groupInStockItemsByBranch,
  migrateStructuredProductToSimple,
}
