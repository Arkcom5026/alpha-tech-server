const { prisma } = require('../../../../../lib/prisma')

const ORPHAN_TEMPLATE_PRODUCT_SELECT = {
  id: true,
  name: true,
  active: true,
  branchId: true,
  productTypeId: true,
  saleBarcode: true,
  createdAt: true,
  updatedAt: true,
  productType: {
    select: {
      id: true,
      name: true,
      branchId: true,
      globalProductTypeId: true,
    },
  },
  brand: { select: { id: true, name: true, normalizedName: true } },
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

const findUnreferencedTemplateProducts = ({ templateBranchId }) =>
  prisma.product.findMany({
    where: {
      active: true,
      productType: { branchId: Number(templateBranchId) },
      clonedProducts: { none: {} },
    },
    select: ORPHAN_TEMPLATE_PRODUCT_SELECT,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

module.exports = {
  ORPHAN_TEMPLATE_PRODUCT_SELECT,
  findTemplateBranch,
  findUnreferencedTemplateProducts,
}
