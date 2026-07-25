const { prisma } = require('../../../../../lib/prisma')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const findBranchScopedProduct = ({ productId, branchId, db = prisma } = {}) => {
  const id = toInt(productId)
  const brId = toInt(branchId)
  if (!id || !brId) return null

  return db.product.findFirst({
    where: {
      id,
      productType: { branchId: brId },
    },
    select: { id: true },
  })
}

const deactivateProductImageByPublicId = ({ productId, publicId, db = prisma } = {}) => {
  return db.productImage.updateMany({
    where: {
      productId: Number(productId),
      public_id: publicId,
    },
    data: {
      active: false,
      isCover: false,
    },
  })
}

module.exports = {
  toInt,
  findBranchScopedProduct,
  deactivateProductImageByPublicId,
}
