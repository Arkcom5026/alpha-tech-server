const { prisma } = require('../../../../../lib/prisma')

const getDb = (db) => db || prisma

const findProductSummaryById = ({ productId, db } = {}) =>
  getDb(db).product.findUnique({
    where: { id: Number(productId) },
    select: { id: true, name: true, active: true },
  })

const setProductActive = ({ productId, active, db } = {}) =>
  getDb(db).product.update({
    where: { id: Number(productId) },
    data: { active: Boolean(active) },
    select: { id: true, name: true, active: true },
  })

const safeCount = async ({ modelName, where, db } = {}) => {
  try {
    const model = getDb(db)?.[modelName]
    if (!model || typeof model.count !== 'function') return 0
    const count = await model.count({ where })
    return Number.isFinite(Number(count)) ? Number(count) : null
  } catch (_error) {
    return null
  }
}

const getProductUsageCounts = async ({ productId, db } = {}) => {
  const id = Number(productId)

  return {
    stockItems: await safeCount({ modelName: 'stockItem', where: { productId: id }, db }),
    purchaseOrderItems: await safeCount({ modelName: 'purchaseOrderItem', where: { productId: id }, db }),
    purchaseOrderReceiptItems: await safeCount({ modelName: 'purchaseOrderReceiptItem', where: { productId: id }, db }),
    saleItemSimple: await safeCount({ modelName: 'saleItemSimple', where: { productId: id }, db }),
    orderOnlineItems: await safeCount({ modelName: 'orderOnlineItem', where: { productId: id }, db }),
    cartItems: await safeCount({ modelName: 'cartItem', where: { productId: id }, db }),
    productOnOrders: await safeCount({ modelName: 'productOnOrder', where: { productId: id }, db }),
    stockMovements: await safeCount({ modelName: 'stockMovement', where: { productId: id }, db }),
    simpleLots: await safeCount({ modelName: 'simpleLot', where: { productId: id }, db }),
    branchPrices: await safeCount({ modelName: 'branchPrice', where: { productId: id }, db }),
    stockBalances: await safeCount({ modelName: 'stockBalance', where: { productId: id }, db }),
    productImages: await safeCount({ modelName: 'productImage', where: { productId: id }, db }),
  }
}

const hardDeleteProduct = ({ productId } = {}) =>
  prisma.$transaction(async (tx) => {
    const id = Number(productId)
    await tx.branchPrice.deleteMany({ where: { productId: id } })
    await tx.stockBalance.deleteMany({ where: { productId: id } })
    await tx.productImage.deleteMany({ where: { productId: id } })
    await tx.product.delete({ where: { id } })
  }, { timeout: 15000 })

module.exports = {
  findProductSummaryById,
  setProductActive,
  getProductUsageCounts,
  hardDeleteProduct,
}
