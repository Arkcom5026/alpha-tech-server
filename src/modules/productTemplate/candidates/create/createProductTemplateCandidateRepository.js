const { prisma } = require('../../../../../lib/prisma')

const SOURCE_PRODUCT_SELECT = {
  id: true,
  branchId: true,
  name: true,
  active: true,
  productTypeId: true,
  brandId: true,
  unitId: true,
  productType: {
    select: {
      id: true,
      name: true,
      globalProductTypeId: true,
      globalProductType: { select: { id: true, name: true, categoryId: true } },
    },
  },
  brand: { select: { id: true, name: true, normalizedName: true } },
  unit: { select: { id: true, name: true } },
}

const findSourceProduct = ({ sourceProductId }) =>
  prisma.product.findUnique({ where: { id: sourceProductId }, select: SOURCE_PRODUCT_SELECT })

const findProductOwnershipEvidence = async ({ sourceProductId }) => {
  const [branchPrices, stockItems] = await Promise.all([
    prisma.branchPrice.findMany({
      where: { productId: sourceProductId },
      select: { branchId: true },
      distinct: ['branchId'],
    }),
    prisma.stockItem.findMany({
      where: { productId: sourceProductId },
      select: { branchId: true },
      distinct: ['branchId'],
    }),
  ])

  return {
    branchPriceBranchIds: branchPrices.map((item) => item.branchId),
    stockItemBranchIds: stockItems.map((item) => item.branchId),
  }
}

const findTemplateBranch = ({ targetTemplateBranchId }) =>
  prisma.branch.findFirst({
    where: {
      id: targetTemplateBranchId,
      branchCode: 'T01',
    },
    select: { id: true, name: true, branchCode: true },
  })

const createCandidateWithEvent = ({ data, actorEmployeeId, ownershipResolution }) =>
  prisma.$transaction(async (tx) => {
    const candidate = await tx.productTemplateCandidate.create({
      data,
      include: {
        sourceBranch: { select: { id: true, name: true, branchCode: true } },
        sourceProduct: { select: { id: true, name: true, branchId: true } },
        targetTemplateBranch: { select: { id: true, name: true, branchCode: true } },
      },
    })

    const event = await tx.productTemplateCandidateEvent.create({
      data: {
        candidateId: candidate.id,
        eventType: 'CREATED',
        previousStatus: null,
        resultingStatus: candidate.status,
        actorEmployeeId,
        metadata: {
          sourceBranchId: candidate.sourceBranchId,
          sourceProductId: candidate.sourceProductId,
          targetTemplateBranchId: candidate.targetTemplateBranchId,
          ownershipResolution,
        },
      },
    })

    return { candidate, event }
  })

module.exports = {
  SOURCE_PRODUCT_SELECT,
  findSourceProduct,
  findProductOwnershipEvidence,
  findTemplateBranch,
  createCandidateWithEvent,
}
