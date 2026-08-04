const {
  auditDiscovery,
} = require('./auditProductTemplateDiscoveryService')
const {
  GROUP_REVIEW_STATUS,
} = require('./groupProductTemplateDiscovery')
const {
  createCandidate,
} = require('../create/createProductTemplateCandidateService')
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

const isDuplicateCandidateError = (error) =>
  error?.code === 'P2002' ||
  error?.code === 'PRODUCT_TEMPLATE_CANDIDATE_ALREADY_EXISTS' ||
  error?.status === 409

const materializeGroupCandidates = async ({ user, templateBranchId, groups }) => {
  const created = []
  const skipped = []
  const failed = []

  for (const group of groups) {
    const groupCreated = []
    const groupSkipped = []
    const groupFailed = []

    for (const sourceProduct of group.sourceProducts || []) {
      try {
        const result = await createCandidate({
          user,
          payload: {
            sourceProductId: sourceProduct.id,
            sourceBranchId: sourceProduct.branchId,
            targetTemplateBranchId: templateBranchId,
          },
        })
        groupCreated.push({
          candidateId: result.candidate.id,
          sourceProductId: sourceProduct.id,
          sourceBranchId: sourceProduct.branchId,
        })
      } catch (error) {
        const evidence = {
          sourceProductId: sourceProduct.id,
          sourceBranchId: sourceProduct.branchId,
          code: error?.code || 'PRODUCT_TEMPLATE_GROUP_MATERIALIZATION_FAILED',
          message: error?.message || 'Candidate materialization failed',
        }
        if (isDuplicateCandidateError(error)) groupSkipped.push(evidence)
        else groupFailed.push(evidence)
      }
    }

    if (groupCreated.length) {
      created.push({
        groupKey: group.groupKey,
        candidateCount: groupCreated.length,
        candidates: groupCreated,
      })
    }
    if (groupSkipped.length) {
      skipped.push({ groupKey: group.groupKey, products: groupSkipped })
    }
    if (groupFailed.length) {
      failed.push({ groupKey: group.groupKey, products: groupFailed })
    }
  }

  return { created, skipped, failed }
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

  const materialized = apply
    ? await materializeGroupCandidates({
        user,
        templateBranchId: audit.templateBranch.id,
        groups: eligibleGroups,
      })
    : { created: [], skipped: [], failed: [] }

  return {
    mode: apply ? 'GROUPED_APPLY' : 'GROUPED_DRY_RUN',
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
    created: materialized.created,
    skipped: materialized.skipped,
    failed: materialized.failed,
  }
}

module.exports = {
  toBoolean,
  toLimit,
  isDuplicateCandidateError,
  materializeGroupCandidates,
  materializeDiscovery,
}
