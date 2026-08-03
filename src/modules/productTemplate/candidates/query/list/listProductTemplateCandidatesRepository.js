const { prisma } = require('../../../../../../lib/prisma')

const CANDIDATE_LIST_SELECT = {
  id: true,
  sourceBranchId: true,
  sourceProductId: true,
  targetTemplateBranchId: true,
  targetTemplateProductId: true,
  status: true,
  sourceSnapshot: true,
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
  createdByEmployee: { select: { id: true, name: true } },
  reviewedByEmployee: { select: { id: true, name: true } },
  _count: { select: { events: true } },
}

const listCandidates = ({ where, skip, take }) =>
  prisma.$transaction([
    prisma.productTemplateCandidate.findMany({
      where,
      select: CANDIDATE_LIST_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    }),
    prisma.productTemplateCandidate.count({ where }),
  ])

module.exports = {
  CANDIDATE_LIST_SELECT,
  listCandidates,
}
