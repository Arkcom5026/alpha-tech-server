const { prisma } = require('../../../../../lib/prisma')

const PRODUCT_DISCOVERY_SELECT = {
  id: true,
  branchId: true,
  name: true,
  active: true,
  templateProductId: true,
  productType: {
    select: {
      id: true,
      name: true,
      globalProductTypeId: true,
    },
  },
  brand: {
    select: {
      id: true,
      name: true,
      normalizedName: true,
    },
  },
  unit: { select: { id: true, name: true } },
  branch: {
    select: {
      id: true,
      name: true,
      branchCode: true,
      businessType: true,
      categoryId: true,
    },
  },
}

const BRANCH_DISCOVERY_SELECT = {
  id: true,
  name: true,
  address: true,
  branchCode: true,
  businessType: true,
  categoryId: true,
}

const findTemplateBranchByBusinessType = ({ businessType }) =>
  prisma.branch.findFirst({
    where: {
      businessType,
      address: 'SYSTEM TEMPLATE',
      branchCode: { not: null },
      categoryId: { not: null },
    },
    select: BRANCH_DISCOVERY_SELECT,
    orderBy: { id: 'asc' },
  })

const findStoreBranchesByCategory = ({ categoryId, templateBranchId }) =>
  prisma.branch.findMany({
    where: {
      categoryId,
      id: { not: templateBranchId },
      address: {
        notIn: ['SYSTEM TEMPLATE', 'SYSTEM TEST ONLY'],
      },
    },
    select: BRANCH_DISCOVERY_SELECT,
    orderBy: { id: 'asc' },
  })

const findStoreProducts = ({ branchIds }) =>
  prisma.product.findMany({
    where: {
      branchId: { in: branchIds },
      active: true,
    },
    select: PRODUCT_DISCOVERY_SELECT,
    orderBy: [{ branchId: 'asc' }, { id: 'asc' }],
  })

const findTemplateProducts = ({ templateBranchId }) =>
  prisma.product.findMany({
    where: {
      branchId: templateBranchId,
      active: true,
    },
    select: PRODUCT_DISCOVERY_SELECT,
    orderBy: [{ branchId: 'asc' }, { id: 'asc' }],
  })

const findOpenCandidates = ({ sourceProductIds }) =>
  prisma.productTemplateCandidate.findMany({
    where: {
      sourceProductId: { in: sourceProductIds },
      status: { in: ['DRAFT', 'UNDER_REVIEW'] },
    },
    select: {
      id: true,
      sourceProductId: true,
      status: true,
      targetTemplateProductId: true,
    },
    orderBy: { id: 'desc' },
  })

module.exports = {
  PRODUCT_DISCOVERY_SELECT,
  BRANCH_DISCOVERY_SELECT,
  findTemplateBranchByBusinessType,
  findStoreBranchesByCategory,
  findStoreProducts,
  findTemplateProducts,
  findOpenCandidates,
}
