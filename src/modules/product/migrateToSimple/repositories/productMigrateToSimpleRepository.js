// src/modules/product/migrateToSimple/repositories/productMigrateToSimpleRepository.js

const { prisma } = require('../../../../../lib/prisma')

const findProduct = ({ db = prisma, productId }) =>
  db.product.findUnique({
    where: { id: Number(productId) },
    select: { id: true, mode: true },
  })

const groupInStockItemsByBranch = ({ db = prisma, productId }) =>
  db.stockItem.groupBy({
    by: ['branchId'],
    where: { productId: Number(productId), status: 'IN_STOCK' },
    _count: { _all: true },
  })

const upsertStockBalance = ({ db = prisma, productId, branchId, quantity }) =>
  db.stockBalance.upsert({
    where: {
      productId_branchId: {
        productId: Number(productId),
        branchId: Number(branchId),
      },
    },
    update: { quantity: { increment: Number(quantity) } },
    create: {
      productId: Number(productId),
      branchId: Number(branchId),
      quantity: Number(quantity),
      reserved: 0,
    },
  })

const markStockItemsUsed = ({ db = prisma, productId, branchId }) =>
  db.stockItem.updateMany({
    where: {
      productId: Number(productId),
      branchId: Number(branchId),
      status: 'IN_STOCK',
    },
    data: { status: 'USED' },
  })

const setProductSimple = ({ db = prisma, productId }) =>
  db.product.update({
    where: { id: Number(productId) },
    data: {
      mode: 'SIMPLE',
      noSN: true,
      trackSerialNumber: false,
    },
  })

module.exports = {
  prisma,
  findProduct,
  groupInStockItemsByBranch,
  upsertStockBalance,
  markStockItemsUsed,
  setProductSimple,
}
