const { prisma } = require('../../../../../lib/prisma')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

const getDb = (db) => db || prisma

const listProductPrices = ({ productId, branchId, db } = {}) => {
  const client = getDb(db)
  return client.branchPrice.findMany({
    where: {
      productId: toInt(productId),
      ...(toInt(branchId) ? { branchId: toInt(branchId) } : {}),
    },
    orderBy: [{ branchId: 'asc' }, { id: 'asc' }],
  })
}

const findProductPrice = ({ priceId, productId, db } = {}) => {
  const client = getDb(db)
  return client.branchPrice.findFirst({
    where: {
      id: toInt(priceId),
      productId: toInt(productId),
    },
  })
}

const upsertBranchPrice = ({ productId, branchId, employeeId, payload, db } = {}) => {
  const client = getDb(db)
  const productIdValue = toInt(productId)
  const branchIdValue = toInt(branchId)

  return client.branchPrice.upsert({
    where: {
      productId_branchId: {
        productId: productIdValue,
        branchId: branchIdValue,
      },
    },
    update: {
      ...payload,
      updatedBy: toInt(employeeId),
    },
    create: {
      productId: productIdValue,
      branchId: branchIdValue,
      ...payload,
      updatedBy: toInt(employeeId),
    },
  })
}

const deleteProductPrice = ({ priceId, productId, db } = {}) => {
  const client = getDb(db)
  return client.branchPrice.deleteMany({
    where: {
      id: toInt(priceId),
      productId: toInt(productId),
    },
  })
}

module.exports = {
  toInt,
  listProductPrices,
  findProductPrice,
  upsertBranchPrice,
  deleteProductPrice,
}
