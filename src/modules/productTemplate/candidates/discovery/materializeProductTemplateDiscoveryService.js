const {
  auditDiscovery,
  DISCOVERY_CLASSIFICATION,
} = require('./auditProductTemplateDiscoveryService')
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

const materializeDiscovery = async ({ user, payload = {} }) => {
  assertSuperAdmin(user)

  const businessType = String(payload.businessType || '').trim().toUpperCase()
  const apply = toBoolean(payload.apply)
  const limit = toLimit(payload.limit)

  const audit = await auditDiscovery({ user, query: { businessType } })
  const eligible = audit.items
    .filter((item) => item.classification === DISCOVERY_CLASSIFICATION.UNMATCHED)
    .slice(0, limit)

  if (!apply) {
    return {
      mode: 'DRY_RUN',
      businessType: audit.businessType,
      templateBranch: audit.templateBranch,
      categoryId: audit.categoryId,
      eligibleCount: eligible.length,
      sourceProductIds: eligible.map((item) => item.sourceProduct.id),
      created: [],
      failed: [],
    }
  }

  const created = []
  const failed = []

  for (const item of eligible) {
    try {
      const candidate = await createCandidate({
        user,
        payload: {
          sourceProductId: item.sourceProduct.id,
          sourceBranchId: item.sourceProduct.branchId,
          targetTemplateBranchId: audit.templateBranch.id,
        },
      })
      created.push({
        candidateId: candidate.id,
        sourceProductId: item.sourceProduct.id,
        sourceBranchId: item.sourceProduct.branchId,
      })
    } catch (error) {
      failed.push({
        sourceProductId: item.sourceProduct.id,
        sourceBranchId: item.sourceProduct.branchId,
        code: error.code || 'DISCOVERY_CANDIDATE_CREATE_FAILED',
        message: error.message,
      })
    }
  }

  return {
    mode: 'APPLY',
    businessType: audit.businessType,
    templateBranch: audit.templateBranch,
    categoryId: audit.categoryId,
    eligibleCount: eligible.length,
    createdCount: created.length,
    failedCount: failed.length,
    created,
    failed,
  }
}

module.exports = {
  toBoolean,
  toLimit,
  materializeDiscovery,
}
