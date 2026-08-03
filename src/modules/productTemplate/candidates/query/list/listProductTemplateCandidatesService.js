const repository = require('./listProductTemplateCandidatesRepository')
const {
  createHttpError,
  assertSuperAdmin,
  toPositiveInt,
} = require('../../shared/productTemplateCandidatePolicy')

const ALLOWED_STATUSES = new Set([
  'DRAFT',
  'UNDER_REVIEW',
  'REJECTED',
  'PROMOTED',
  'MERGED',
  'CANCELLED',
])

const toPageNumber = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const normalizeStatus = (value) => {
  if (value === undefined || value === null || value === '') return null
  const status = String(value).trim().toUpperCase()
  if (!ALLOWED_STATUSES.has(status)) {
    throw createHttpError(400, 'Invalid candidate status', 'INVALID_CANDIDATE_STATUS')
  }
  return status
}

const listCandidates = async ({ user, query = {} }) => {
  assertSuperAdmin(user)

  const page = toPageNumber(query.page, 1)
  const pageSize = Math.min(toPageNumber(query.pageSize, 30), 100)
  const status = normalizeStatus(query.status)
  const sourceBranchId = query.sourceBranchId
    ? toPositiveInt(query.sourceBranchId, 'sourceBranchId')
    : null
  const targetTemplateBranchId = query.targetTemplateBranchId
    ? toPositiveInt(query.targetTemplateBranchId, 'targetTemplateBranchId')
    : null

  const where = {
    ...(status ? { status } : {}),
    ...(sourceBranchId ? { sourceBranchId } : {}),
    ...(targetTemplateBranchId ? { targetTemplateBranchId } : {}),
  }

  const [items, total] = await repository.listCandidates({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  }
}

module.exports = {
  ALLOWED_STATUSES,
  normalizeStatus,
  listCandidates,
}
