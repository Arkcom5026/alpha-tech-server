const { prisma } = require('../../../../../lib/prisma')

const findExistingProductModels = async ({
  branchId,
  productTypeId,
  brandId,
  take,
  db = prisma,
} = {}) => (
  db.product.findMany({
    where: {
      active: true,
      productTypeId: Number(productTypeId),
      brandId: Number(brandId),
      branchPrice: {
        some: {
          branchId: Number(branchId),
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: [
      { name: 'asc' },
      { id: 'asc' },
    ],
    take,
  })
)

module.exports = {
  findExistingProductModels,
}
