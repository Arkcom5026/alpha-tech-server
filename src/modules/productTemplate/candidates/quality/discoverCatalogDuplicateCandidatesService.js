const repository = require('./discoverCatalogDuplicateCandidatesRepository')
const {
  createCatalogQualityCandidate,
  CANDIDATE_TYPES,
  isTemplateBranch,
  normalizeBusinessType,
} = require('./createCatalogQualityCandidateService')
const {
  buildCandidateBuckets,
  buildAssessedDuplicatePairs,
  scoreDuplicatePair,
} = require('./catalogDuplicateAssessment')
const {
  assertSuperAdmin,
  createHttpError,
  toPositiveInt,
} = require('../shared/productTemplateCandidatePolicy')

const toBoolean = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

const discoverCatalogDuplicateCandidates = async ({ user, payload = {} }) => {
  assertSuperAdmin(user)

  const templateBranchId = toPositiveInt(payload.templateBranchId, 'templateBranchId')
  const businessType = normalizeBusinessType(payload.businessType)
  const apply = toBoolean(payload.apply)

  const templateBranch = await repository.findTemplateBranch({ templateBranchId })
  if (!templateBranch || !isTemplateBranch(templateBranch)) {
    throw createHttpError(422, 'Selected branch is not a Template branch', 'TEMPLATE_BRANCH_INVALID')
  }
  if (businessType && businessType !== templateBranch.businessType) {
    throw createHttpError(
      409,
      'Duplicate discovery businessType must match the Template branch businessType',
      'CANDIDATE_BUSINESS_TYPE_MISMATCH'
    )
  }

  const products = await repository.findTemplateProducts({ templateBranchId })
  const candidateBuckets = buildCandidateBuckets(products)
  const duplicatePairs = buildAssessedDuplicatePairs(products)

  const created = []
  const existing = []
  if (apply) {
    for (const pair of duplicatePairs) {
      const result = await createCatalogQualityCandidate({
        user,
        payload: {
          type: CANDIDATE_TYPES.POSSIBLE_DUPLICATE,
          templateBranchId,
          businessType: templateBranch.businessType,
          primaryTemplateProductId: pair.primary.id,
          comparisonTemplateProductId: pair.comparison.id,
          assessmentEvidence: pair.assessment,
        },
      })
      const row = {
        candidateId: result.candidate?.id || null,
        primaryTemplateProductId: pair.primary.id,
        comparisonTemplateProductId: pair.comparison.id,
        confidence: pair.assessment.confidence,
        reason: pair.assessment.reason,
        signals: pair.assessment.signals,
      }
      if (result.created) created.push(row)
      else existing.push(row)
    }
  }

  const confidenceSummary = duplicatePairs.reduce((summary, pair) => {
    const key = pair.assessment.confidence || 'UNCLASSIFIED'
    summary[key] = (summary[key] || 0) + 1
    return summary
  }, {})

  return {
    mode: apply ? 'APPLY' : 'DRY_RUN',
    businessType: templateBranch.businessType,
    templateBranch: {
      id: templateBranch.id,
      name: templateBranch.name,
      branchCode: templateBranch.branchCode,
      categoryId: templateBranch.categoryId,
    },
    scannedProductCount: products.length,
    candidateBucketCount: candidateBuckets.size,
    duplicatePairCount: duplicatePairs.length,
    confidenceSummary,
    duplicatePairs: duplicatePairs.map((pair) => ({
      assessment: {
        confidence: pair.assessment.confidence,
        reason: pair.assessment.reason,
        signals: pair.assessment.signals,
      },
      primary: {
        id: pair.primary.id,
        name: pair.primary.name,
        localReferenceCount: pair.primary._count?.clonedProducts || 0,
      },
      comparison: {
        id: pair.comparison.id,
        name: pair.comparison.name,
        localReferenceCount: pair.comparison._count?.clonedProducts || 0,
      },
    })),
    created,
    existing,
  }
}

module.exports = {
  toBoolean,
  buildCandidateBuckets,
  scoreDuplicatePair,
  discoverCatalogDuplicateCandidates,
}
