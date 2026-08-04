const { prisma } = require('../../../../../../lib/prisma')

const mergeCandidateTransaction = ({ candidateId, targetTemplateProductId, actorEmployeeId, decisionNote, reviewedAt }) =>
  prisma.$transaction(async (tx) => {
    const candidateBefore = await tx.productTemplateCandidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        status: true,
        targetTemplateBranchId: true,
        targetTemplateProductId: true,
      },
    })

    if (!candidateBefore) return { transitioned: false, current: null, targetTemplateProduct: null }

    const targetTemplateProduct = await tx.product.findFirst({
      where: {
        id: targetTemplateProductId,
        productType: { branchId: candidateBefore.targetTemplateBranchId },
      },
      select: {
        id: true,
        name: true,
        active: true,
        productTypeId: true,
        brandId: true,
        unitId: true,
        productType: { select: { branchId: true } },
      },
    })

    if (!targetTemplateProduct) {
      return { transitioned: false, current: candidateBefore, targetTemplateProduct: null }
    }

    const transition = await tx.productTemplateCandidate.updateMany({
      where: {
        id: candidateId,
        status: 'UNDER_REVIEW',
        targetTemplateProductId: null,
      },
      data: {
        status: 'MERGED',
        targetTemplateProductId,
        reviewedByEmployeeId: actorEmployeeId,
        reviewedAt,
        decisionNote,
      },
    })

    if (transition.count !== 1) {
      const current = await tx.productTemplateCandidate.findUnique({
        where: { id: candidateId },
        select: { id: true, status: true, targetTemplateProductId: true },
      })
      return { transitioned: false, current, targetTemplateProduct }
    }

    const candidate = await tx.productTemplateCandidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        sourceBranchId: true,
        sourceProductId: true,
        targetTemplateBranchId: true,
        targetTemplateProductId: true,
        status: true,
        reviewedByEmployeeId: true,
        reviewedAt: true,
        decisionNote: true,
        updatedAt: true,
      },
    })

    const event = await tx.productTemplateCandidateEvent.create({
      data: {
        candidateId,
        eventType: 'MERGED',
        previousStatus: 'UNDER_REVIEW',
        resultingStatus: 'MERGED',
        actorEmployeeId,
        note: decisionNote,
        metadata: {
          command: 'MERGE',
          targetTemplateProductId,
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

    return { transitioned: true, candidate, targetTemplateProduct, event }
  })

module.exports = { mergeCandidateTransaction }
