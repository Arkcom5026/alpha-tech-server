const { prisma } = require('../../../../../lib/prisma')

const TEMPLATE_PRODUCT_SELECT = {
  id: true,
  name: true,
  active: true,
  branchId: true,
  productTypeId: true,
  brandId: true,
  unitId: true,
  saleBarcode: true,
  warrantyDays: true,
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

const findTemplateProduct = ({ templateBranchId, productId }) =>
  prisma.product.findFirst({
    where: {
      id: Number(productId),
      OR: [
        { branchId: Number(templateBranchId) },
        { productType: { branchId: Number(templateBranchId) } },
      ],
    },
    select: TEMPLATE_PRODUCT_SELECT,
  })

const findCandidateByDedupeKey = ({ dedupeKey }) =>
  prisma.productTemplateCandidate.findUnique({
    where: { dedupeKey },
  })

const createCandidateWithEvent = ({ data, actorEmployeeId }) =>
  prisma.$transaction(async (tx) => {
    const candidate = await tx.productTemplateCandidate.create({
      data: {
        sourceBranchId: null,
        sourceProductId: null,
        targetTemplateBranchId: null,
        targetTemplateProductId: null,
        sourceSnapshot: data.sourceSnapshot,
        proposedTemplateData: null,
        duplicateAssessment: data.type === 'POSSIBLE_DUPLICATE' ? data.assessment : null,
        type: data.type,
        templateBranchId: data.templateBranchId,
        primaryTemplateProductId: data.primaryTemplateProductId,
        comparisonTemplateProductId: data.comparisonTemplateProductId,
        dedupeKey: data.dedupeKey,
        assessment: data.assessment,
        resolution: null,
        status: 'OPEN',
        createdByEmployeeId: actorEmployeeId,
      },
    })

    const event = await tx.productTemplateCandidateEvent.create({
      data: {
        candidateId: candidate.id,
        eventType: 'CREATED',
        previousStatus: null,
        resultingStatus: 'OPEN',
        actorEmployeeId,
        metadata: {
          authority: 'TEMPLATE_CATALOG_QUALITY',
          type: data.type,
          templateBranchId: data.templateBranchId,
          primaryTemplateProductId: data.primaryTemplateProductId,
          comparisonTemplateProductId: data.comparisonTemplateProductId,
          dedupeKey: data.dedupeKey,
        },
      },
    })

    return { candidate, event }
  })

module.exports = {
  TEMPLATE_PRODUCT_SELECT,
  findTemplateBranch,
  findTemplateProduct,
  findCandidateByDedupeKey,
  createCandidateWithEvent,
}
