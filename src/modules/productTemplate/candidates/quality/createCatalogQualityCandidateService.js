const { BusinessType } = require('@prisma/client')
const repository = require('./createCatalogQualityCandidateRepository')
const {
  assertSuperAdmin,
  createHttpError,
  resolveActorEmployeeId,
  toPositiveInt,
} = require('../shared/productTemplateCandidatePolicy')

const CANDIDATE_TYPES = Object.freeze({
  POSSIBLE_DUPLICATE: 'POSSIBLE_DUPLICATE',
  QUALITY_REVIEW: 'QUALITY_REVIEW',
  ORPHAN_UNUSED: 'ORPHAN_UNUSED',
})

const normalizeCandidateType = (value) => {
  const type = String(value || '').trim().toUpperCase()
  if (!Object.values(CANDIDATE_TYPES).includes(type)) {
    throw createHttpError(400, 'Valid catalog quality candidate type is required', 'INVALID_CANDIDATE_TYPE')
  }
  return type
}

const normalizeBusinessType = (value) => {
  if (value === undefined || value === null || value === '') return null
  const businessType = String(value).trim().toUpperCase()
  if (!Object.values(BusinessType).includes(businessType)) {
    throw createHttpError(400, 'Valid businessType is required', 'INVALID_BUSINESS_TYPE')
  }
  return businessType
}

const isTemplateBranch = (branch) => String(branch?.branchCode || '').trim().toUpperCase().startsWith('T')

const buildCandidateDedupeKey = ({
  type,
  templateBranchId,
  primaryTemplateProductId,
  comparisonTemplateProductId,
}) => {
  if (type === CANDIDATE_TYPES.POSSIBLE_DUPLICATE) {
    const low = Math.min(primaryTemplateProductId, comparisonTemplateProductId)
    const high = Math.max(primaryTemplateProductId, comparisonTemplateProductId)
    return `DUPLICATE:${templateBranchId}:${low}:${high}`
  }
  if (type === CANDIDATE_TYPES.QUALITY_REVIEW) {
    return `QUALITY:${templateBranchId}:${primaryTemplateProductId}`
  }
  return `ORPHAN:${templateBranchId}:${primaryTemplateProductId}`
}

const buildTemplateSnapshot = (product) => ({
  id: product.id,
  name: product.name,
  active: product.active,
  branchId: product.branchId,
  productTypeId: product.productTypeId,
  globalProductTypeId: product.productType?.globalProductTypeId || null,
  productTypeName: product.productType?.name || null,
  brandId: product.brandId,
  brandName: product.brand?.name || null,
  unitId: product.unitId,
  unitName: product.unit?.name || null,
  saleBarcode: product.saleBarcode || null,
  warrantyDays: product.warrantyDays || null,
  localReferenceCount: product._count?.clonedProducts || 0,
})

const createCatalogQualityCandidate = async ({ user, payload = {} }) => {
  assertSuperAdmin(user)

  const type = normalizeCandidateType(payload.type)
  const templateBranchId = toPositiveInt(payload.templateBranchId, 'templateBranchId')
  const primaryTemplateProductId = toPositiveInt(
    payload.primaryTemplateProductId,
    'primaryTemplateProductId'
  )
  const requestedBusinessType = normalizeBusinessType(payload.businessType)

  const templateBranch = await repository.findTemplateBranch({ templateBranchId })
  if (!templateBranch) {
    throw createHttpError(404, 'Template branch was not found', 'TEMPLATE_BRANCH_REQUIRED')
  }
  if (!isTemplateBranch(templateBranch)) {
    throw createHttpError(422, 'Selected branch is not a Template branch', 'TEMPLATE_BRANCH_INVALID')
  }
  if (requestedBusinessType && requestedBusinessType !== templateBranch.businessType) {
    throw createHttpError(
      409,
      'Candidate businessType must match the Template branch businessType',
      'CANDIDATE_BUSINESS_TYPE_MISMATCH'
    )
  }

  const primaryProduct = await repository.findTemplateProduct({
    templateBranchId,
    productId: primaryTemplateProductId,
  })
  if (!primaryProduct) {
    throw createHttpError(
      422,
      'Primary Product must belong to the selected Template branch',
      'PRIMARY_TEMPLATE_PRODUCT_INVALID'
    )
  }

  let comparisonTemplateProductId = null
  let comparisonProduct = null
  if (type === CANDIDATE_TYPES.POSSIBLE_DUPLICATE) {
    comparisonTemplateProductId = toPositiveInt(
      payload.comparisonTemplateProductId,
      'comparisonTemplateProductId'
    )
    if (comparisonTemplateProductId === primaryTemplateProductId) {
      throw createHttpError(
        400,
        'Duplicate candidate requires two different Template Products',
        'DUPLICATE_COMPARISON_REQUIRED'
      )
    }
    comparisonProduct = await repository.findTemplateProduct({
      templateBranchId,
      productId: comparisonTemplateProductId,
    })
    if (!comparisonProduct) {
      throw createHttpError(
        422,
        'Comparison Product must belong to the same Template branch',
        'COMPARISON_TEMPLATE_PRODUCT_INVALID'
      )
    }
  }

  if (type === CANDIDATE_TYPES.ORPHAN_UNUSED && (primaryProduct._count?.clonedProducts || 0) !== 0) {
    throw createHttpError(
      409,
      'Template Product still has Local Product references',
      'ORPHAN_PRODUCT_STILL_REFERENCED'
    )
  }

  const dedupeKey = buildCandidateDedupeKey({
    type,
    templateBranchId,
    primaryTemplateProductId,
    comparisonTemplateProductId,
  })
  const existing = await repository.findCandidateByDedupeKey({ dedupeKey })
  if (existing) {
    return {
      created: false,
      idempotent: true,
      candidate: existing,
      templateBranch,
    }
  }

  const primarySnapshot = buildTemplateSnapshot(primaryProduct)
  const comparisonSnapshot = comparisonProduct ? buildTemplateSnapshot(comparisonProduct) : null
  const assessment = {
    authority: 'TEMPLATE_CATALOG_QUALITY',
    type,
    businessType: templateBranch.businessType,
    templateBranchId,
    primary: primarySnapshot,
    comparison: comparisonSnapshot,
  }
  const actorEmployeeId = resolveActorEmployeeId(user)

  const result = await repository.createCandidateWithEvent({
    actorEmployeeId,
    data: {
      type,
      templateBranchId,
      primaryTemplateProductId,
      comparisonTemplateProductId,
      dedupeKey,
      sourceSnapshot: primarySnapshot,
      assessment,
    },
  })

  return {
    created: true,
    idempotent: false,
    ...result,
    templateBranch,
  }
}

module.exports = {
  CANDIDATE_TYPES,
  normalizeCandidateType,
  normalizeBusinessType,
  isTemplateBranch,
  buildCandidateDedupeKey,
  buildTemplateSnapshot,
  createCatalogQualityCandidate,
}
