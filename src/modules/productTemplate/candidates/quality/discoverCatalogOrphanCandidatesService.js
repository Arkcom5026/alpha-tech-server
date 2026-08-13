const repository = require('./discoverCatalogOrphanCandidatesRepository')
const { createCatalogQualityCandidate, CANDIDATE_TYPES, isTemplateBranch, normalizeBusinessType } = require('./createCatalogQualityCandidateService')
const { assertSuperAdmin, createHttpError, toPositiveInt } = require('../shared/productTemplateCandidatePolicy')

const toBoolean = (value) => ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase())

const discoverCatalogOrphanCandidates = async ({ user, payload = {} }) => {
  assertSuperAdmin(user)
  const templateBranchId = toPositiveInt(payload.templateBranchId, 'templateBranchId')
  const businessType = normalizeBusinessType(payload.businessType)
  const apply = toBoolean(payload.apply)

  const templateBranch = await repository.findTemplateBranch({ templateBranchId })
  if (!templateBranch || !isTemplateBranch(templateBranch)) {
    throw createHttpError(422, 'Selected branch is not a Template branch', 'TEMPLATE_BRANCH_INVALID')
  }
  if (businessType && businessType !== templateBranch.businessType) {
    throw createHttpError(409, 'Orphan discovery businessType must match the Template branch businessType', 'CANDIDATE_BUSINESS_TYPE_MISMATCH')
  }

  const products = await repository.findUnreferencedTemplateProducts({ templateBranchId })
  const created = []
  const existing = []
  if (apply) {
    for (const product of products) {
      const result = await createCatalogQualityCandidate({
        user,
        payload: {
          type: CANDIDATE_TYPES.ORPHAN_UNUSED,
          templateBranchId,
          businessType: templateBranch.businessType,
          primaryTemplateProductId: product.id,
        },
      })
      const row = { candidateId: result.candidate?.id || null, templateProductId: product.id, name: product.name }
      if (result.created) created.push(row)
      else existing.push(row)
    }
  }

  return {
    mode: apply ? 'APPLY' : 'DRY_RUN',
    businessType: templateBranch.businessType,
    templateBranch: { id: templateBranch.id, name: templateBranch.name, branchCode: templateBranch.branchCode, categoryId: templateBranch.categoryId },
    orphanCount: products.length,
    orphans: products.map((product) => ({ id: product.id, name: product.name, createdAt: product.createdAt, updatedAt: product.updatedAt, localReferenceCount: product._count?.clonedProducts || 0 })),
    created,
    existing,
  }
}

module.exports = { toBoolean, discoverCatalogOrphanCandidates }
