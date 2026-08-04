const { BusinessType } = require('@prisma/client')
const {
  DEFAULT_TEMPLATE_BRANCH_CODE,
} = require('../../repositories/productTemplateRepository')
const repository = require('./auditProductTemplateDiscoveryRepository')
const {
  GROUP_REVIEW_STATUS,
  groupUnmatchedDiscoveryItems,
} = require('./groupProductTemplateDiscovery')
const {
  assertSuperAdmin,
  createHttpError,
} = require('../shared/productTemplateCandidatePolicy')

const BUSINESS_TYPE_TEMPLATE_BRANCH_CODE = Object.freeze({
  [BusinessType.IT]: DEFAULT_TEMPLATE_BRANCH_CODE,
})

const DISCOVERY_CLASSIFICATION = Object.freeze({
  LINKED_TEMPLATE: 'LINKED_TEMPLATE',
  MATCHED_UNLINKED: 'MATCHED_UNLINKED',
  CANDIDATE_OPEN: 'CANDIDATE_OPEN',
  UNMATCHED: 'UNMATCHED',
})

const normalizeBusinessType = (value) => {
  const businessType = String(value || '').trim().toUpperCase()
  if (!businessType || !Object.values(BusinessType).includes(businessType)) {
    throw createHttpError(400, 'Valid businessType is required', 'INVALID_BUSINESS_TYPE')
  }
  return businessType
}

const resolveTemplateBranchCode = (businessType) => {
  const branchCode = BUSINESS_TYPE_TEMPLATE_BRANCH_CODE[businessType]
  if (!branchCode) {
    throw createHttpError(
      409,
      'No Template Branch mapping exists for the selected business scope',
      'TEMPLATE_BRANCH_MAPPING_NOT_CONFIGURED'
    )
  }
  return branchCode
}

const normalizeCatalogText = (value) =>
  String(value || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('th-TH')
    .replace(/[^\p{L}\p{N}]+/gu, '')

const buildCatalogFingerprint = (product) => {
  const name = normalizeCatalogText(product?.name)
  const brand = normalizeCatalogText(product?.brand?.normalizedName || product?.brand?.name)
  const globalProductTypeId = product?.productType?.globalProductTypeId || null
  if (!name || !globalProductTypeId) return null
  return `${globalProductTypeId}:${brand}:${name}`
}

const resolveProductOwnershipBranch = (product) =>
  product?.productType?.branch || null

const emptySummary = () => ({
  storeProducts: 0,
  linkedTemplate: 0,
  matchedUnlinked: 0,
  candidateOpen: 0,
  unmatched: 0,
})

const emptyGroupSummary = () => ({
  groups: 0,
  ready: 0,
  productTypeReviewRequired: 0,
  sourceProducts: 0,
})

const auditDiscovery = async ({ user, query = {} }) => {
  assertSuperAdmin(user)
  const businessType = normalizeBusinessType(query.businessType)
  const templateBranchCode = resolveTemplateBranchCode(businessType)

  const templateBranch = await repository.findTemplateBranchByCode({
    branchCode: templateBranchCode,
  })
  if (!templateBranch) {
    throw createHttpError(
      409,
      'No Template Branch exists for the selected business scope',
      'TEMPLATE_BRANCH_NOT_FOUND'
    )
  }

  const storeBranches = await repository.findStoreBranchesByCategory({
    categoryId: templateBranch.categoryId,
    templateBranchId: templateBranch.id,
  })

  if (storeBranches.length === 0) {
    return {
      businessType,
      templateBranchCode,
      categoryId: templateBranch.categoryId,
      templateBranch,
      storeBranches: [],
      templateBranches: [templateBranch],
      summary: emptySummary(),
      groupSummary: emptyGroupSummary(),
      groups: [],
      items: [],
    }
  }

  const [storeProducts, templateProducts] = await Promise.all([
    repository.findStoreProducts({ branchIds: storeBranches.map((branch) => branch.id) }),
    repository.findTemplateProducts({ templateBranchId: templateBranch.id }),
  ])

  const openCandidates = storeProducts.length
    ? await repository.findOpenCandidates({ sourceProductIds: storeProducts.map((product) => product.id) })
    : []
  const openCandidateByProductId = new Map()
  for (const candidate of openCandidates) {
    if (!openCandidateByProductId.has(candidate.sourceProductId)) {
      openCandidateByProductId.set(candidate.sourceProductId, candidate)
    }
  }

  const templateById = new Map(templateProducts.map((product) => [product.id, product]))
  const templateByFingerprint = new Map()
  for (const product of templateProducts) {
    const fingerprint = buildCatalogFingerprint(product)
    if (fingerprint && !templateByFingerprint.has(fingerprint)) {
      templateByFingerprint.set(fingerprint, product)
    }
  }

  const items = storeProducts.map((product) => {
    const linkedTemplate = product.templateProductId
      ? templateById.get(product.templateProductId) || null
      : null
    const openCandidate = openCandidateByProductId.get(product.id) || null
    const fingerprint = buildCatalogFingerprint(product)
    const exactTemplate = fingerprint ? templateByFingerprint.get(fingerprint) || null : null
    const ownershipBranch = resolveProductOwnershipBranch(product)

    let classification = DISCOVERY_CLASSIFICATION.UNMATCHED
    let matchedTemplate = null
    if (linkedTemplate) {
      classification = DISCOVERY_CLASSIFICATION.LINKED_TEMPLATE
      matchedTemplate = linkedTemplate
    } else if (openCandidate) {
      classification = DISCOVERY_CLASSIFICATION.CANDIDATE_OPEN
    } else if (exactTemplate) {
      classification = DISCOVERY_CLASSIFICATION.MATCHED_UNLINKED
      matchedTemplate = exactTemplate
    }

    const matchedTemplateBranch = matchedTemplate
      ? resolveProductOwnershipBranch(matchedTemplate)
      : null

    return {
      classification,
      fingerprint,
      sourceProduct: {
        id: product.id,
        name: product.name,
        branchId: ownershipBranch?.id || product.productType?.branchId || null,
        branchName: ownershipBranch?.name || null,
        businessType,
        categoryId: templateBranch.categoryId,
        productTypeId: product.productType?.id || null,
        globalProductTypeId: product.productType?.globalProductTypeId || null,
        productTypeName: product.productType?.name || null,
        brandId: product.brand?.id || null,
        brandName: product.brand?.name || null,
        unitId: product.unit?.id || null,
        unitName: product.unit?.name || null,
        templateProductId: product.templateProductId || null,
      },
      matchedTemplate: matchedTemplate
        ? {
            id: matchedTemplate.id,
            name: matchedTemplate.name,
            branchId: matchedTemplateBranch?.id || matchedTemplate.productType?.branchId || null,
            branchName: matchedTemplateBranch?.name || null,
          }
        : null,
      openCandidate,
    }
  })

  const count = (classification) =>
    items.filter((item) => item.classification === classification).length
  const unmatchedItems = items.filter(
    (item) => item.classification === DISCOVERY_CLASSIFICATION.UNMATCHED
  )
  const groups = groupUnmatchedDiscoveryItems(unmatchedItems)
  const groupCount = (reviewStatus) =>
    groups.filter((group) => group.reviewStatus === reviewStatus).length

  return {
    businessType,
    templateBranchCode,
    categoryId: templateBranch.categoryId,
    templateBranch,
    storeBranches,
    templateBranches: [templateBranch],
    summary: {
      storeProducts: items.length,
      linkedTemplate: count(DISCOVERY_CLASSIFICATION.LINKED_TEMPLATE),
      matchedUnlinked: count(DISCOVERY_CLASSIFICATION.MATCHED_UNLINKED),
      candidateOpen: count(DISCOVERY_CLASSIFICATION.CANDIDATE_OPEN),
      unmatched: unmatchedItems.length,
    },
    groupSummary: {
      groups: groups.length,
      ready: groupCount(GROUP_REVIEW_STATUS.READY),
      productTypeReviewRequired: groupCount(
        GROUP_REVIEW_STATUS.PRODUCT_TYPE_REVIEW_REQUIRED
      ),
      sourceProducts: groups.reduce(
        (total, group) => total + group.sourceProductCount,
        0
      ),
    },
    groups,
    items,
  }
}

module.exports = {
  BUSINESS_TYPE_TEMPLATE_BRANCH_CODE,
  DISCOVERY_CLASSIFICATION,
  normalizeBusinessType,
  resolveTemplateBranchCode,
  normalizeCatalogText,
  buildCatalogFingerprint,
  resolveProductOwnershipBranch,
  auditDiscovery,
}
