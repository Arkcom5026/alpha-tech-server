const repository = require('./createProductTemplateCandidateRepository')
const {
  resolveProductOwnershipEvidence,
} = require('./resolveProductOwnershipEvidence')
const {
  createHttpError,
  toPositiveInt,
  assertSuperAdmin,
  resolveActorEmployeeId,
} = require('../shared/productTemplateCandidatePolicy')

const buildCatalogSafeSnapshot = (product, sourceBranchId, ownershipResolution) => ({
  sourceProductId: product.id,
  sourceBranchId,
  ownershipResolution,
  name: product.name,
  active: product.active,
  productType: product.productType
    ? {
        id: product.productType.id,
        name: product.productType.name,
        globalProductTypeId: product.productType.globalProductTypeId,
        globalProductType: product.productType.globalProductType
          ? {
              id: product.productType.globalProductType.id,
              name: product.productType.globalProductType.name,
              categoryId: product.productType.globalProductType.categoryId,
            }
          : null,
      }
    : null,
  brand: product.brand
    ? {
        id: product.brand.id,
        name: product.brand.name,
        normalizedName: product.brand.normalizedName,
      }
    : null,
  unit: product.unit ? { id: product.unit.id, name: product.unit.name } : null,
})

const throwOwnershipError = (resolution) => {
  if (resolution.status === 'CANONICAL_MISMATCH') {
    throw createHttpError(
      409,
      'Source branch does not match canonical Product ownership',
      'SOURCE_PRODUCT_BRANCH_MISMATCH'
    )
  }
  if (resolution.status === 'CROSS_BRANCH_CONFLICT') {
    throw createHttpError(
      409,
      'Source product has evidence in more than one independent store',
      'SOURCE_PRODUCT_CROSS_BRANCH_CONFLICT'
    )
  }
  if (resolution.status === 'EVIDENCE_MISMATCH') {
    throw createHttpError(
      409,
      'Source branch does not match the product ownership evidence',
      'SOURCE_PRODUCT_EVIDENCE_MISMATCH'
    )
  }
  if (resolution.status === 'NO_EVIDENCE') {
    throw createHttpError(
      409,
      'Source product has no usable store ownership evidence',
      'SOURCE_PRODUCT_OWNERSHIP_MISSING'
    )
  }

  throw createHttpError(
    400,
    'sourceBranchId is required',
    'SOURCE_BRANCH_ID_REQUIRED'
  )
}

const createCandidate = async ({ user, payload }) => {
  assertSuperAdmin(user)

  const sourceProductId = toPositiveInt(payload?.sourceProductId, 'sourceProductId')
  const sourceBranchId = toPositiveInt(payload?.sourceBranchId, 'sourceBranchId')
  const targetTemplateBranchId = toPositiveInt(
    payload?.targetTemplateBranchId,
    'targetTemplateBranchId'
  )

  const sourceProduct = await repository.findSourceProduct({ sourceProductId })
  if (!sourceProduct) {
    throw createHttpError(404, 'Source product was not found', 'SOURCE_PRODUCT_NOT_FOUND')
  }

  const evidence = sourceProduct.branchId
    ? { branchPriceBranchIds: [], stockItemBranchIds: [] }
    : await repository.findProductOwnershipEvidence({ sourceProductId })

  const ownershipResolution = resolveProductOwnershipEvidence({
    canonicalBranchId: sourceProduct.branchId,
    requestedSourceBranchId: sourceBranchId,
    ...evidence,
  })

  if (!['CANONICAL', 'SINGLE_BRANCH_EVIDENCE'].includes(ownershipResolution.status)) {
    throwOwnershipError(ownershipResolution)
  }

  const resolvedSourceBranchId = ownershipResolution.branchId
  const targetTemplateBranch = await repository.findTemplateBranch({ targetTemplateBranchId })
  if (!targetTemplateBranch) {
    throw createHttpError(
      422,
      'Target branch is not the SYSTEM TEMPLATE branch',
      'INVALID_TEMPLATE_BRANCH'
    )
  }
  if (resolvedSourceBranchId === targetTemplateBranch.id) {
    throw createHttpError(
      409,
      'A template-owned product cannot be submitted as a store candidate',
      'TEMPLATE_PRODUCT_NOT_ELIGIBLE'
    )
  }

  const actorEmployeeId = resolveActorEmployeeId(user)
  const sourceSnapshot = buildCatalogSafeSnapshot(
    sourceProduct,
    resolvedSourceBranchId,
    ownershipResolution.status
  )

  return repository.createCandidateWithEvent({
    actorEmployeeId,
    ownershipResolution: {
      mode: ownershipResolution.status,
      evidenceBranchIds: ownershipResolution.evidenceBranchIds,
    },
    data: {
      sourceBranchId: resolvedSourceBranchId,
      sourceProductId: sourceProduct.id,
      targetTemplateBranchId: targetTemplateBranch.id,
      sourceSnapshot,
      proposedTemplateData: null,
      duplicateAssessment: null,
      createdByEmployeeId: actorEmployeeId,
    },
  })
}

module.exports = {
  buildCatalogSafeSnapshot,
  throwOwnershipError,
  createCandidate,
}
