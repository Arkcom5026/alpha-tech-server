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

const findStoreBranches = ({ businessType }) =>
  prisma.branch.findMany({
    where: {
      businessType,
      NOT: {
        OR: [
          { address: 'SYSTEM TEMPLATE' },
          { branchCode: { not: null } },
        ],
      },
    },
    select: {
      id: true,
      name: true,
      branchCode: true,
      businessType: true,
      categoryId: true,
    },
    orderBy: { id: 'asc' },
  })

const findTemplateBranches = ({ categoryIds }) =>
  prisma.branch.findMany({
    where: {
      categoryId: { in: categoryIds },
      OR: [
        { address: 'SYSTEM TEMPLATE' },
        { branchCode: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      branchCode: true,
      businessType: true,
      categoryId: true,
    },
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

const findTemplateProducts = ({ templateBranchIds }) =>
  prisma.product.findMany({
    where: {
      branchId: { in: templateBranchIds },
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
  findStoreBranches,
  findTemplateBranches,
  findStoreProducts,
  findTemplateProducts,
  findOpenCandidates,
}
