const repository = require('./createProductTemplateCandidateRepository')
const {
  createHttpError,
  toPositiveInt,
  assertSuperAdmin,
  resolveActorEmployeeId,
} = require('../shared/productTemplateCandidatePolicy')

const buildCatalogSafeSnapshot = (product) => ({
  sourceProductId: product.id,
  sourceBranchId: product.branchId,
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

const createCandidate = async ({ user, payload }) => {
  assertSuperAdmin(user)

  const sourceProductId = toPositiveInt(payload?.sourceProductId, 'sourceProductId')
  const targetTemplateBranchId = toPositiveInt(
    payload?.targetTemplateBranchId,
    'targetTemplateBranchId'
  )

  const sourceProduct = await repository.findSourceProduct({ sourceProductId })
  if (!sourceProduct) {
    throw createHttpError(404, 'Source product was not found', 'SOURCE_PRODUCT_NOT_FOUND')
  }
  if (!sourceProduct.branchId) {
    throw createHttpError(
      409,
      'Source product has no canonical branch ownership',
      'SOURCE_PRODUCT_OWNERSHIP_MISSING'
    )
  }

  const targetTemplateBranch = await repository.findTemplateBranch({ targetTemplateBranchId })
  if (!targetTemplateBranch) {
    throw createHttpError(
      422,
      'Target branch is not the SYSTEM TEMPLATE branch',
      'INVALID_TEMPLATE_BRANCH'
    )
  }
  if (sourceProduct.branchId === targetTemplateBranch.id) {
    throw createHttpError(
      409,
      'A template-owned product cannot be submitted as a store candidate',
      'TEMPLATE_PRODUCT_NOT_ELIGIBLE'
    )
  }

  const actorEmployeeId = resolveActorEmployeeId(user)
  const sourceSnapshot = buildCatalogSafeSnapshot(sourceProduct)

  return repository.createCandidateWithEvent({
    actorEmployeeId,
    data: {
      sourceBranchId: sourceProduct.branchId,
      sourceProductId: sourceProduct.id,
      targetTemplateBranchId: targetTemplateBranch.id,
      sourceSnapshot,
      proposedTemplateData: payload?.proposedTemplateData || null,
      duplicateAssessment: null,
      createdByEmployeeId: actorEmployeeId,
    },
  })
}

module.exports = {
  buildCatalogSafeSnapshot,
  createCandidate,
}
