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

const listCandidates = ({ where, summaryWhere, skip, take, orderBy }) =>
  prisma.$transaction([
    prisma.productTemplateCandidate.findMany({
      where,
      select: CANDIDATE_LIST_SELECT,
      orderBy,
      skip,
      take,
    }),
    prisma.productTemplateCandidate.count({ where }),
    prisma.productTemplateCandidate.groupBy({
      by: ['status'],
      where: summaryWhere,
      _count: { _all: true },
    }),
    prisma.productTemplateCandidate.groupBy({
      by: ['reviewedByEmployeeId', 'status'],
      where: {
        ...summaryWhere,
        reviewedByEmployeeId: { not: null },
      },
      _count: { _all: true },
    }),
  ])

module.exports = {
  CANDIDATE_LIST_SELECT,
  listCandidates,
}
