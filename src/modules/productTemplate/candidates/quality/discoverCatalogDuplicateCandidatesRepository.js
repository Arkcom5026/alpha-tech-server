const { prisma } = require('../../../../../lib/prisma')

const TEMPLATE_DUPLICATE_DISCOVERY_SELECT = {
  id: true,
  name: true,
  active: true,
  saleBarcode: true,
  productTypeId: true,
  productType: {
    select: {
      id: true,
      name: true,
      branchId: true,
      globalProductTypeId: true,
    },
  },
  brandId: true,
  brand: {
    select: { id: true, name: true, normalizedName: true },
  },
  unitId: true,
  unit: { select: { id: true, name: true } },
  _count: { select: { clonedProducts: true } },
}

const findTemplateBranch = ({ templateBranchId }) =>
  prisma.branch.findUnique({
    where: { id: Number(templateBranchId) },
    select: {
      id: true,
      name: true,
      branchCode: true,
      businessType: true,
      categoryId: true,
    },
  })

const findTemplateProducts = ({ templateBranchId }) =>
  prisma.product.findMany({
    where: {
      active: true,
      productType: { branchId: Number(templateBranchId) },
    },
    select: TEMPLATE_DUPLICATE_DISCOVERY_SELECT,
    orderBy: { id: 'asc' },
  })

module.exports = {
  TEMPLATE_DUPLICATE_DISCOVERY_SELECT,
  findTemplateBranch,
  findTemplateProducts,
}
