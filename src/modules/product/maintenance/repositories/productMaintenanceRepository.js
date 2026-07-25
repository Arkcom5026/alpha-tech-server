const { prisma } = require('../../../../../lib/prisma')

const getDb = (db) => db || prisma

const findOperationalProductForUpdate = ({ db, productId, branchId } = {}) => (
  getDb(db).product.findFirst({
    where: {
      id: Number(productId),
      productType: { branchId: Number(branchId) },
    },
    select: { id: true, productTypeId: true },
  })
)

const findOperationalProductType = ({ db, productTypeId, branchId } = {}) => (
  getDb(db).productType.findFirst({
    where: {
      id: Number(productTypeId),
      branchId: Number(branchId),
    },
    select: {
      id: true,
      branchId: true,
      globalProductType: { select: { categoryId: true } },
    },
  })
)

const updateProduct = ({ db, productId, data } = {}) => (
  getDb(db).product.update({
    where: { id: Number(productId) },
    data,
    select: { id: true },
  })
)

const upsertBranchPrice = ({ db, productId, branchId, update, create } = {}) => (
  getDb(db).branchPrice.upsert({
    where: {
      productId_branchId: {
        productId: Number(productId),
        branchId: Number(branchId),
      },
    },
    update,
    create: {
      productId: Number(productId),
      branchId: Number(branchId),
      ...create,
    },
  })
)

const ensureProductTypeBrand = async ({ db, productTypeId, brandId } = {}) => {
  const client = getDb(db)
  const ptId = Number(productTypeId)
  const brId = Number(brandId)
  if (!ptId || !brId) return null

  try {
    return await client.productTypeBrand.create({
      data: { productTypeId: ptId, brandId: brId },
    })
  } catch (error) {
    if (error?.code === 'P2002') return null
    throw error
  }
}

const rebuildSimpleStockBalance = async ({ db, productId, branchId } = {}) => {
  const client = getDb(db)
  let quantity = 0

  try {
    quantity = await client.stockItem.count({
      where: {
        productId: Number(productId),
        branchId: Number(branchId),
        status: 'IN_STOCK',
      },
    })
  } catch (_error) {
    quantity = 0
  }

  return client.stockBalance.upsert({
    where: {
      productId_branchId: {
        productId: Number(productId),
        branchId: Number(branchId),
      },
    },
    update: { quantity },
    create: {
      productId: Number(productId),
      branchId: Number(branchId),
      quantity,
      reserved: 0,
    },
  })
}

const transaction = (callback, options = { timeout: 15000 }) => prisma.$transaction(callback, options)

module.exports = {
  transaction,
  findOperationalProductForUpdate,
  findOperationalProductType,
  updateProduct,
  upsertBranchPrice,
  ensureProductTypeBrand,
  rebuildSimpleStockBalance,
}
