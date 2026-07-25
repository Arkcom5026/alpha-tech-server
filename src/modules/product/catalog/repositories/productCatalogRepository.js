const { prisma } = require('../../../../../lib/prisma')

const countOperationalProducts = ({ where }, db = prisma) => {
  return db.product.count({ where })
}

const findOperationalProducts = ({ where, take, skip }, db = prisma) => {
  return db.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      mode: true,
      active: true,
      productTypeId: true,
      productType: {
        select: {
          id: true,
          name: true,
          globalProductType: {
            select: {
              categoryId: true,
              category: { select: { id: true, name: true } },
            },
          },
        },
      },
      brandId: true,
      brand: { select: { id: true, name: true, active: true } },
      unitId: true,
      unit: { select: { id: true, name: true } },
    },
    take,
    skip,
    orderBy: { id: 'desc' },
  })
}

module.exports = {
  countOperationalProducts,
  findOperationalProducts,
}
