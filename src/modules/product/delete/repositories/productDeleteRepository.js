// src/modules/product/delete/repositories/productDeleteRepository.js

const { prisma } = require('../../../../../lib/prisma')

const usageModels = [
  ['stockItems', 'stockItem'],
  ['purchaseOrderItems', 'purchaseOrderItem'],
  ['purchaseOrderReceiptItems', 'purchaseOrderReceiptItem'],
  ['saleItemSimple', 'saleItemSimple'],
  ['orderOnlineItems', 'orderOnlineItem'],
  ['cartItems', 'cartItem'],
  ['productOnOrders', 'productOnOrder'],
  ['stockMovements', 'stockMovement'],
  ['simpleLots', 'simpleLot'],
  ['branchPrices', 'branchPrice'],
  ['stockBalances', 'stockBalance'],
  ['productImages', 'productImage'],
]

const findProduct = ({ db = prisma, productId }) =>
  db.product.findUnique({
    where: { id: Number(productId) },
    select: { id: true, name: true, active: true },
  })

const safeCount = async ({ db = prisma, modelName, productId }) => {
  try {
    const model = db?.[modelName]
    if (!model || typeof model.count !== 'function') return null
    const count = await model.count({ where: { productId: Number(productId) } })
    return Number.isFinite(Number(count)) ? Number(count) : null
  } catch (_error) {
    return null
  }
}

const getUsageCounts = async ({ db = prisma, productId }) => {
  const entries = await Promise.all(
    usageModels.map(async ([key, modelName]) => [
      key,
      await safeCount({ db, modelName, productId }),
    ])
  )
  return Object.fromEntries(entries)
}

const hardDeleteProduct = ({ db = prisma, productId }) =>
  db.$transaction(async (tx) => {
    await tx.branchPrice.deleteMany({ where: { productId: Number(productId) } })
    await tx.stockBalance.deleteMany({ where: { productId: Number(productId) } })
    await tx.productImage.deleteMany({ where: { productId: Number(productId) } })
    await tx.product.delete({ where: { id: Number(productId) } })
  }, { timeout: 15000 })

module.exports = {
  prisma,
  findProduct,
  getUsageCounts,
  hardDeleteProduct,
}
