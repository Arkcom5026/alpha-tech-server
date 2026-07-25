// src/modules/product/update/repositories/productUpdateRepository.js

const { prisma } = require('../../../../../lib/prisma')

const findBranchProduct = ({ db = prisma, productId, branchId }) =>
  db.product.findFirst({
    where: {
      id: Number(productId),
      productType: { branchId: Number(branchId) },
    },
    select: { id: true, productTypeId: true },
  })

const findBranchProductType = ({ db = prisma, productTypeId, branchId }) =>
  db.productType.findFirst({
    where: { id: Number(productTypeId), branchId: Number(branchId) },
    select: {
      id: true,
      branchId: true,
      globalProductType: { select: { categoryId: true } },
    },
  })

const updateProduct = ({ db = prisma, productId, data }) =>
  db.product.update({ where: { id: Number(productId) }, data, select: { id: true } })

const upsertBranchPrice = ({ db = prisma, productId, branchId, update, create }) =>
  db.branchPrice.upsert({
    where: { productId_branchId: { productId: Number(productId), branchId: Number(branchId) } },
    update,
    create,
  })

const ensureProductTypeBrand = async ({ db = prisma, productTypeId, brandId }) => {
  if (!productTypeId || !brandId) return
  try {
    await db.productTypeBrand.create({ data: { productTypeId: Number(productTypeId), brandId: Number(brandId) } })
  } catch (error) {
    if (error?.code !== 'P2002') throw error
  }
}

module.exports = {
  prisma,
  findBranchProduct,
  findBranchProductType,
  updateProduct,
  upsertBranchPrice,
  ensureProductTypeBrand,
}
