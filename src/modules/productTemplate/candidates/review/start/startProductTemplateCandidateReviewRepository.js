const { prisma } = require('../../../../../../lib/prisma')

const startReviewTransaction = ({ candidateId, actorEmployeeId, reviewedAt }) =>
  prisma.$transaction(async (tx) => {
    const transition = await tx.productTemplateCandidate.updateMany({
      where: {
        id: candidateId,
        status: 'DRAFT',
      },
      data: {
        status: 'UNDER_REVIEW',
        reviewedByEmployeeId: actorEmployeeId,
        reviewedAt,
      },
    })

    if (transition.count !== 1) {
      const current = await tx.productTemplateCandidate.findUnique({
        where: { id: candidateId },
        select: { id: true, status: true },
      })
      return { transitioned: false, current }
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
        updatedAt: true,
      },
    })

    const event = await tx.productTemplateCandidateEvent.create({
      data: {
        candidateId,
        eventType: 'REVIEW_STARTED',
        previousStatus: 'DRAFT',
        resultingStatus: 'UNDER_REVIEW',
        actorEmployeeId,
        metadata: {
          command: 'START_REVIEW',
        },
      },
      select: {
        id: true,
        candidateId: true,
        eventType: true,
        previousStatus: true,
        resultingStatus: true,
        actorEmployeeId: true,
        createdAt: true,
      },
    })

    return { transitioned: true, candidate, event }
  })

module.exports = { startReviewTransaction }
