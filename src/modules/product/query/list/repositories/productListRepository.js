// src/modules/product/query/list/repositories/productListRepository.js

const { prisma } = require('../../../../../../lib/prisma')

const toInt = (value) =>
  value === undefined || value === null || value === ''
    ? undefined
    : Number.parseInt(value, 10)

const buildWhere = ({ branchId, search, categoryId, productTypeId, brandId } = {}) => {
  const whereAND = [
    {
      productType: {
        branchId: Number(branchId),
      },
    },
  ]

  if (search) {
    whereAND.push({
      OR: [{ name: { contains: String(search), mode: 'insensitive' } }],
    })
  }

  const catId = toInt(categoryId)
  if (catId) {
    whereAND.push({
      productType: {
        globalProductType: { categoryId: catId },
      },
    })
  }

  const typeId = toInt(productTypeId)
  if (typeId) whereAND.push({ productTypeId: typeId })

  const brId = toInt(brandId)
  if (brId) whereAND.push({ brandId: brId })

  return { AND: whereAND }
}

const listOperationalProducts = async ({
  branchId,
  search = '',
  take = 100,
  page = 1,
  categoryId,
  productTypeId,
  brandId,
} = {}) => {
  const takeNum = Math.max(1, Math.min(toInt(take) ?? 100, 200))
  const pageNum = toInt(page) || 1
  const skipNum = Math.max(0, (pageNum - 1) * takeNum)
  const where = buildWhere({ branchId, search, categoryId, productTypeId, brandId })

  return prisma.product.findMany({
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
    take: takeNum,
    skip: skipNum,
    orderBy: { id: 'desc' },
  })
}

module.exports = {
  toInt,
  buildWhere,
  listOperationalProducts,
}
