const repository = require('./discoverCatalogQualityCandidatesRepository')
const {
  createCatalogQualityCandidate,
  CANDIDATE_TYPES,
  isTemplateBranch,
  normalizeBusinessType,
} = require('./createCatalogQualityCandidateService')
const {
  assertSuperAdmin,
  createHttpError,
  toPositiveInt,
} = require('../shared/productTemplateCandidatePolicy')

const toBoolean = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

const normalizeCatalogText = (value) =>
  String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')

const assessTemplateProductQuality = (product) => {
  const issues = []
  const name = normalizeCatalogText(product?.name)

  if (!name || name.length < 3) issues.push({ code: 'NAME_MISSING_OR_TOO_SHORT', severity: 'HIGH' })
  if (!product?.productTypeId || !product?.productType?.globalProductTypeId) {
    issues.push({ code: 'PRODUCT_TYPE_AUTHORITY_MISSING', severity: 'HIGH' })
  }
  if (!product?.brandId) issues.push({ code: 'BRAND_MISSING', severity: 'MEDIUM' })
  if (!product?.unitId) issues.push({ code: 'UNIT_MISSING', severity: 'MEDIUM' })
  if (!String(product?.saleBarcode || '').trim()) {
    issues.push({ code: 'SALE_BARCODE_MISSING', severity: 'LOW' })
  }
  if (!Array.isArray(product?.productImages) || product.productImages.length === 0) {
    issues.push({ code: 'IMAGE_MISSING', severity: 'LOW' })
  } else if (!product.productImages.some((image) => image.isCover === true)) {
    issues.push({ code: 'COVER_IMAGE_MISSING', severity: 'LOW' })
  }

  const score = issues.reduce((sum, issue) => {
    if (issue.severity === 'HIGH') return sum + 4
    if (issue.severity === 'MEDIUM') return sum + 2
    return sum + 1
  }, 0)

  return {
    needsReview: issues.length > 0,
    score,
    issues,
    localReferenceCount: product?._count?.clonedProducts || 0,
  }
}

const discoverCatalogQualityCandidates = async ({ user, payload = {} }) => {
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
      'Quality discovery businessType must match the Template branch businessType',
      'CANDIDATE_BUSINESS_TYPE_MISMATCH'
    )
  }

  const products = await repository.findTemplateProducts({ templateBranchId })
  const findings = products
    .map((product) => ({ product, assessment: assessTemplateProductQuality(product) }))
    .filter((item) => item.assessment.needsReview)
    .sort((a, b) => b.assessment.score - a.assessment.score || a.product.id - b.product.id)

  const created = []
  const existing = []
  if (apply) {
    for (const finding of findings) {
      const result = await createCatalogQualityCandidate({
        user,
        payload: {
          type: CANDIDATE_TYPES.QUALITY_REVIEW,
          templateBranchId,
          businessType: templateBranch.businessType,
          primaryTemplateProductId: finding.product.id,
          assessment: {
            authority: 'TEMPLATE_CATALOG_QUALITY',
            type: CANDIDATE_TYPES.QUALITY_REVIEW,
            quality: finding.assessment,
          },
        },
      })
      const row = {
        candidateId: result.candidate?.id || null,
        templateProductId: finding.product.id,
        score: finding.assessment.score,
        issues: finding.assessment.issues,
      }
      if (result.created) created.push(row)
      else existing.push(row)
    }
  }

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
    qualityCandidateCount: findings.length,
    findings: findings.map(({ product, assessment }) => ({
      templateProductId: product.id,
      name: product.name,
      score: assessment.score,
      issues: assessment.issues,
      localReferenceCount: assessment.localReferenceCount,
    })),
    created,
    existing,
  }
}

module.exports = {
  toBoolean,
  normalizeCatalogText,
  assessTemplateProductQuality,
  discoverCatalogQualityCandidates,
}
