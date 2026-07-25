// src/modules/product/imageDelete/repositories/productImageDeleteRepository.js

const { prisma } = require('../../../../../lib/prisma')

const findBranchProduct = ({ db = prisma, productId, branchId }) =>
  db.product.findFirst({
    where: {
      id: Number(productId),
      productType: { branchId: Number(branchId) },
    },
    select: { id: true },
  })

const deactivateProductImage = ({ db = prisma, productId, publicId }) =>
  db.productImage.updateMany({
    where: { productId: Number(productId), public_id: publicId },
    data: { active: false, isCover: false },
  })

module.exports = {
  prisma,
  findBranchProduct,
  deactivateProductImage,
}
