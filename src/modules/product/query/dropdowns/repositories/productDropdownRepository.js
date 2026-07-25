// src/modules/product/query/dropdowns/repositories/productDropdownRepository.js

const { prisma } = require('../../../../../../lib/prisma')

const listProductTypes = ({ branchId }) =>
  prisma.productType.findMany({
    where: { branchId: Number(branchId) },
    orderBy: { name: 'asc' },
    include: { globalProductType: { select: { categoryId: true } } },
  })

const listUnits = () =>
  prisma.unit.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

const listBrands = ({ includeInactive = false } = {}) =>
  prisma.brand.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, active: true },
  })

const listProductTypeBrands = ({ productTypeIds = [] } = {}) => {
  if (!productTypeIds.length) return []

  return prisma.productTypeBrand.findMany({
    where: { productTypeId: { in: productTypeIds } },
    orderBy: [{ productTypeId: 'asc' }, { brandId: 'asc' }],
    select: { productTypeId: true, brandId: true },
  })
}

module.exports = {
  listProductTypes,
  listUnits,
  listBrands,
  listProductTypeBrands,
}
