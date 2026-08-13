const { prisma } = require('../../../../../../lib/prisma')

const CANDIDATE_DETAIL_SELECT = {
  id: true,
  type: true,
  templateBranchId: true,
  primaryTemplateProductId: true,
  comparisonTemplateProductId: true,
  dedupeKey: true,
  assessment: true,
  resolution: true,
  resolvedAt: true,
  sourceBranchId: true,
  sourceProductId: true,
  targetTemplateBranchId: true,
  targetTemplateProductId: true,
  status: true,
  sourceSnapshot: true,
  proposedTemplateData: true,
  duplicateAssessment: true,
  createdByEmployeeId: true,
  reviewedByEmployeeId: true,
  decisionNote: true,
  reviewedAt: true,
  promotedAt: true,
  createdAt: true,
  updatedAt: true,
  sourceBranch: { select: { id: true, name: true, branchCode: true } },
  sourceProduct: { select: { id: true, name: true, branchId: true } },
  targetTemplateBranch: { select: { id: true, name: true, branchCode: true } },
  targetTemplateProduct: { select: { id: true, name: true, branchId: true } },
  createdByEmployee: { select: { id: true, firstName: true, lastName: true } },
  reviewedByEmployee: { select: { id: true, firstName: true, lastName: true } },
  events: {
    select: {
      id: true,
      eventType: true,
      previousStatus: true,
      resultingStatus: true,
      actorEmployeeId: true,
      note: true,
      metadata: true,
      createdAt: true,
      actorEmployee: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
}

const findCandidateById = ({ candidateId }) =>
  prisma.productTemplateCandidate.findUnique({
    where: { id: candidateId },
    select: CANDIDATE_DETAIL_SELECT,
  })

module.exports = {
  CANDIDATE_DETAIL_SELECT,
  findCandidateById,
}
