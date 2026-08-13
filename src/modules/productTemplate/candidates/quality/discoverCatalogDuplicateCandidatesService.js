const repository = require('./discoverCatalogDuplicateCandidatesRepository')
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

const normalizeCatalogText = (value) =>
  String(value || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('th-TH')
    .replace(/[^\p{L}\p{N}]+/gu, '')

const toBoolean = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

const buildDuplicateFingerprint = (product) => {
  const name = normalizeCatalogText(product?.name)
  const brand = normalizeCatalogText(product?.brand?.normalizedName || product?.brand?.name)
  const globalProductTypeId = Number(product?.productType?.globalProductTypeId) || null
  if (!name || !globalProductTypeId) return null
  return `${globalProductTypeId}:${brand}:${name}`
}

const groupDuplicatePairs = (products) => {
  const groups = new Map()
  for (const product of products || []) {
    const exactFingerprint = buildDuplicateFingerprint(product)
    if (!exactFingerprint) continue
    const current = groups.get(exactFingerprint) || []
    current.push(product)
    groups.set(exactFingerprint, current)
  }

  const duplicates = []
  for (const [exactFingerprint, group] of groups.entries()) {
    if (group.length < 2) continue
    const sorted = [...group].sort((a, b) => a.id - b.id)
    const primary = sorted[0]
    for (const comparison of sorted.slice(1)) {
      duplicates.push({
        exactFingerprint,
        primary,
        comparison,
      })
    }
  }
  return duplicates
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
  const duplicatePairs = groupDuplicatePairs(products)

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
        },
      })
      const row = {
        candidateId: result.candidate?.id || null,
        primaryTemplateProductId: pair.primary.id,
        comparisonTemplateProductId: pair.comparison.id,
        exactFingerprint: pair.exactFingerprint,
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
    duplicatePairCount: duplicatePairs.length,
    duplicatePairs: duplicatePairs.map((pair) => ({
      exactFingerprint: pair.exactFingerprint,
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
  normalizeCatalogText,
  toBoolean,
  buildDuplicateFingerprint,
  groupDuplicatePairs,
  discoverCatalogDuplicateCandidates,
}
