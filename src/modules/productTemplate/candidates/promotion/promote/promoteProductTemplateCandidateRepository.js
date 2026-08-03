const { prisma } = require('../../../../../../lib/prisma')

const promoteCandidateTransaction = ({
  candidateId,
  actorEmployeeId,
  reviewedAt,
  promotedAt,
  decisionNote,
  templateData,
}) =>
  prisma.$transaction(async (tx) => {
    const candidate = await tx.productTemplateCandidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        status: true,
        targetTemplateBranchId: true,
        sourceSnapshot: true,
      },
    })

    if (!candidate || candidate.status !== 'UNDER_REVIEW') {
      return { transitioned: false, current: candidate ? { id: candidate.id, status: candidate.status } : null }
    }

    const productType = await tx.productType.findFirst({
      where: {
        id: templateData.productTypeId,
        branchId: candidate.targetTemplateBranchId,
      },
      select: { id: true },
    })

    if (!productType) {
      return { transitioned: false, invalidTemplateProductType: true, current: candidate }
    }

    const transition = await tx.productTemplateCandidate.updateMany({
      where: {
        id: candidateId,
        status: 'UNDER_REVIEW',
        targetTemplateProductId: null,
      },
      data: {
        status: 'PROMOTED',
        reviewedByEmployeeId: actorEmployeeId,
        reviewedAt,
        promotedAt,
        decisionNote,
      },
    })

    if (transition.count !== 1) {
      const current = await tx.productTemplateCandidate.findUnique({
        where: { id: candidateId },
        select: { id: true, status: true },
      })
      return { transitioned: false, current }
    }

    const templateProduct = await tx.product.create({
      data: {
        branchId: candidate.targetTemplateBranchId,
        name: templateData.name,
        active: templateData.active,
        mode: templateData.mode,
        noSN: templateData.noSN,
        trackSerialNumber: templateData.trackSerialNumber,
        productTypeId: templateData.productTypeId,
        brandId: templateData.brandId,
        unitId: templateData.unitId,
        codeType: templateData.codeType,
        productConfig: templateData.productConfig,
        warrantyDays: templateData.warrantyDays,
      },
      select: {
        id: true,
        branchId: true,
        name: true,
        active: true,
        mode: true,
        noSN: true,
        trackSerialNumber: true,
        productTypeId: true,
        brandId: true,
        unitId: true,
        codeType: true,
        productConfig: true,
        warrantyDays: true,
        createdAt: true,
      },
    })

    const promotedCandidate = await tx.productTemplateCandidate.update({
      where: { id: candidateId },
      data: {
        targetTemplateProductId: templateProduct.id,
        proposedTemplateData: templateData,
      },
      select: {
        id: true,
        sourceBranchId: true,
        sourceProductId: true,
        targetTemplateBranchId: true,
        targetTemplateProductId: true,
        status: true,
        reviewedByEmployeeId: true,
        reviewedAt: true,
        promotedAt: true,
        decisionNote: true,
        updatedAt: true,
      },
    })

    const event = await tx.productTemplateCandidateEvent.create({
      data: {
        candidateId,
        eventType: 'PROMOTED',
        previousStatus: 'UNDER_REVIEW',
        resultingStatus: 'PROMOTED',
        actorEmployeeId,
        note: decisionNote,
        metadata: {
          command: 'PROMOTE',
          targetTemplateProductId: templateProduct.id,
        },
      },
      select: {
        id: true,
        candidateId: true,
        eventType: true,
        previousStatus: true,
        resultingStatus: true,
        actorEmployeeId: true,
        note: true,
        metadata: true,
        createdAt: true,
      },
    })

    return {
      transitioned: true,
      candidate: promotedCandidate,
      templateProduct,
      event,
    }
  })

module.exports = { promoteCandidateTransaction }
