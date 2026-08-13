const { prisma } = require('../../../../../lib/prisma')

const QUALITY_TEMPLATE_PRODUCT_SELECT = {
  id: true,
  name: true,
  active: true,
  branchId: true,
  saleBarcode: true,
  warrantyDays: true,
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
  brand: { select: { id: true, name: true, normalizedName: true } },
  unitId: true,
  unit: { select: { id: true, name: true } },
  productImages: {
    where: { active: true },
    select: { id: true, isCover: true },
    orderBy: { id: 'asc' },
  },
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
    select: QUALITY_TEMPLATE_PRODUCT_SELECT,
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
  })

module.exports = {
  QUALITY_TEMPLATE_PRODUCT_SELECT,
  findTemplateBranch,
  findTemplateProducts,
}
