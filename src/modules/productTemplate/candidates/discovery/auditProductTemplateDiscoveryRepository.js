const { prisma } = require('../../../../../lib/prisma')

const OWNERSHIP_BRANCH_SELECT = {
  id: true,
  name: true,
  branchCode: true,
  businessType: true,
  categoryId: true,
}

const PRODUCT_DISCOVERY_SELECT = {
  id: true,
  name: true,
  active: true,
  templateProductId: true,
  productType: {
    select: {
      id: true,
      name: true,
      branchId: true,
      globalProductTypeId: true,
      branch: {
        select: OWNERSHIP_BRANCH_SELECT,
      },
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
}

const BRANCH_DISCOVERY_SELECT = {
  id: true,
  name: true,
  address: true,
  branchCode: true,
  businessType: true,
  categoryId: true,
}

const findTemplateBranchByCode = ({ branchCode }) =>
  prisma.branch.findFirst({
    where: {
      branchCode,
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
      productType: {
        branchId: { in: branchIds },
      },
      active: true,
    },
    select: PRODUCT_DISCOVERY_SELECT,
    orderBy: { id: 'asc' },
  })

const findTemplateProducts = ({ templateBranchId }) =>
  prisma.product.findMany({
    where: {
      productType: {
        branchId: templateBranchId,
      },
      active: true,
    },
    select: PRODUCT_DISCOVERY_SELECT,
    orderBy: { id: 'asc' },
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
  OWNERSHIP_BRANCH_SELECT,
  PRODUCT_DISCOVERY_SELECT,
  BRANCH_DISCOVERY_SELECT,
  findTemplateBranchByCode,
  findStoreBranchesByCategory,
  findStoreProducts,
  findTemplateProducts,
  findOpenCandidates,
}
