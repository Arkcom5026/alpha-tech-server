const {
  auditDiscovery,
} = require('../../discovery/auditProductTemplateDiscoveryService')
const {
  GROUP_REVIEW_STATUS,
} = require('../../discovery/groupProductTemplateDiscovery')
const {
  createHttpError,
} = require('../../shared/productTemplateCandidatePolicy')

const normalizePositiveInteger = (value, fallback, maximum) => {
  const parsed = Number(value ?? fallback)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw createHttpError(400, `Value must be between 1 and ${maximum}`, 'INVALID_GROUP_QUERY')
  }
  return parsed
}

const normalizeReviewStatus = (value) => {
  const status = String(value || 'ALL').trim().toUpperCase()
  const allowed = ['ALL', ...Object.values(GROUP_REVIEW_STATUS)]
  if (!allowed.includes(status)) {
    throw createHttpError(400, 'Invalid reviewStatus', 'INVALID_GROUP_REVIEW_STATUS')
  }
  return status
}

const listCanonicalProductGroups = async ({ user, query = {} }) => {
  const page = normalizePositiveInteger(query.page, 1, 100000)
  const pageSize = normalizePositiveInteger(query.pageSize, 30, 100)
  const reviewStatus = normalizeReviewStatus(query.reviewStatus)
  const search = String(query.q || '').trim().toLocaleLowerCase('th-TH')

  const audit = await auditDiscovery({
    user,
    query: { businessType: query.businessType },
  })

  const filtered = (audit.groups || []).filter((group) => {
    if (reviewStatus !== 'ALL' && group.reviewStatus !== reviewStatus) return false
    if (!search) return true

    const searchable = [
      group.canonicalName,
      group.brandName,
      group.groupFingerprint,
      ...(group.sourceBranches || []).map((branch) => branch.name),
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('th-TH')

    return searchable.includes(search)
  })

  filtered.sort((left, right) => {
    if (right.sourceBranchCount !== left.sourceBranchCount) {
      return right.sourceBranchCount - left.sourceBranchCount
    }
    if (right.sourceProductCount !== left.sourceProductCount) {
      return right.sourceProductCount - left.sourceProductCount
    }
    return String(left.canonicalName || '').localeCompare(String(right.canonicalName || ''), 'th')
  })

  const total = filtered.length
  const offset = (page - 1) * pageSize
  const items = filtered.slice(offset, offset + pageSize)

  return {
    businessType: audit.businessType,
    templateBranch: audit.templateBranch,
    categoryId: audit.categoryId,
    summary: audit.groupSummary,
    filters: { reviewStatus, q: String(query.q || '') },
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    items,
  }
}

module.exports = {
  normalizePositiveInteger,
  normalizeReviewStatus,
  listCanonicalProductGroups,
}
