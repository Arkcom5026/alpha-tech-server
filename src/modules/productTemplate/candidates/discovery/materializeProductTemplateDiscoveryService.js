const {
  auditDiscovery,
} = require('./auditProductTemplateDiscoveryService')
const {
  GROUP_REVIEW_STATUS,
} = require('./groupProductTemplateDiscovery')
const {
  assertSuperAdmin,
  createHttpError,
} = require('../shared/productTemplateCandidatePolicy')

const toBoolean = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

const toLimit = (value) => {
  const number = Number(value ?? 100)
  if (!Number.isInteger(number) || number < 1 || number > 500) {
    throw createHttpError(400, 'limit must be between 1 and 500', 'INVALID_DISCOVERY_LIMIT')
  }
  return number
}

const materializeDiscovery = async ({ user, payload = {} }) => {
  assertSuperAdmin(user)

  const businessType = String(payload.businessType || '').trim().toUpperCase()
  const apply = toBoolean(payload.apply)
  const limit = toLimit(payload.limit)

  const audit = await auditDiscovery({ user, query: { businessType } })
  const eligibleGroups = audit.groups
    .filter((group) => group.reviewStatus === GROUP_REVIEW_STATUS.READY)
    .slice(0, limit)
  const reviewRequiredGroups = audit.groups.filter(
    (group) => group.reviewStatus === GROUP_REVIEW_STATUS.PRODUCT_TYPE_REVIEW_REQUIRED
  )

  if (apply) {
    throw createHttpError(
      409,
      'Grouped Candidate materialization is not enabled until group review and persistence authority are approved',
      'GROUPED_CANDIDATE_MATERIALIZATION_NOT_ENABLED'
    )
  }

  return {
    mode: 'GROUPED_DRY_RUN',
    businessType: audit.businessType,
    templateBranch: audit.templateBranch,
    categoryId: audit.categoryId,
    groupSummary: audit.groupSummary,
    eligibleGroupCount: eligibleGroups.length,
    eligibleSourceProductCount: eligibleGroups.reduce(
      (total, group) => total + group.sourceProductCount,
      0
    ),
    reviewRequiredGroupCount: reviewRequiredGroups.length,
    groups: eligibleGroups,
    created: [],
    failed: [],
  }
}

module.exports = {
  toBoolean,
  toLimit,
  materializeDiscovery,
}
