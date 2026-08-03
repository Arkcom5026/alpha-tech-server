const { prisma } = require('../../../../../../lib/prisma')

const rejectCandidateTransaction = ({ candidateId, actorEmployeeId, decisionNote, reviewedAt }) =>
  prisma.$transaction(async (tx) => {
    const transition = await tx.productTemplateCandidate.updateMany({
      where: {
        id: candidateId,
        status: 'UNDER_REVIEW',
      },
      data: {
        status: 'REJECTED',
        reviewedByEmployeeId: actorEmployeeId,
        reviewedAt,
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
        eventType: 'REJECTED',
        previousStatus: 'UNDER_REVIEW',
        resultingStatus: 'REJECTED',
        actorEmployeeId,
        note: decisionNote,
        metadata: {
          command: 'REJECT',
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
        createdAt: true,
      },
    })

    return { transitioned: true, candidate, event }
  })

module.exports = { rejectCandidateTransaction }
