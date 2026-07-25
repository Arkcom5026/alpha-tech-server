// src/modules/product/pricing/repositories/productPricingRepository.js

const { prisma } = require('../../../../../lib/prisma')

const findBranchProduct = ({ db = prisma, productId, branchId }) =>
  db.product.findFirst({
    where: {
      id: Number(productId),
      productType: { branchId: Number(branchId) },
    },
    select: { id: true, name: true },
  })

const findBranchPrice = ({ db = prisma, productId, branchId }) =>
  db.branchPrice.findUnique({
    where: {
      productId_branchId: {
        productId: Number(productId),
        branchId: Number(branchId),
      },
    },
  })

const upsertBranchPrice = ({ db = prisma, productId, branchId, data }) =>
  db.branchPrice.upsert({
    where: {
      productId_branchId: {
        productId: Number(productId),
        branchId: Number(branchId),
      },
    },
    update: data,
    create: {
      productId: Number(productId),
      branchId: Number(branchId),
      ...data,
    },
  })

const deleteBranchPrice = ({ db = prisma, priceId, productId, branchId }) =>
  db.branchPrice.deleteMany({
    where: {
      id: Number(priceId),
      productId: Number(productId),
      branchId: Number(branchId),
    },
  })

module.exports = {
  prisma,
  findBranchProduct,
  findBranchPrice,
  upsertBranchPrice,
  deleteBranchPrice,
}
