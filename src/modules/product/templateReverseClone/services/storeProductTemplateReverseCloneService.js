'use strict'

const { BusinessType } = require('@prisma/client')
const { prisma } = require('../../../../lib/prisma')
const { DEFAULT_TEMPLATE_BRANCH_CODE } = require('../../../productTemplate/repositories/productTemplateRepository')
const { isTaxonomyLabelCompatible } = require('../../templateClone/services/productTemplateCloneService')
const priceAuthorityPolicy = require('../../pricing/policies/priceAuthorityPolicy')

const BUSINESS_TYPE_TEMPLATE_BRANCH_CODE = Object.freeze({
  [BusinessType.IT]: DEFAULT_TEMPLATE_BRANCH_CODE,
})

const normalizeCatalogText = (value) =>
  String(value || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('th-TH')
    .replace(/[^\p{L}\p{N}]+/gu, '')

const buildCatalogFingerprint = (product) => {
  const name = normalizeCatalogText(product?.name)
  const brand = normalizeCatalogText(product?.brand?.normalizedName || product?.brand?.name)
  const globalProductTypeId = Number(product?.productType?.globalProductTypeId) || null
  if (!name || !globalProductTypeId) return null
  return `${globalProductTypeId}:${brand}:${name}`
}

const makeError = (code, status = 409, message = code, details = undefined) => {
  const error = new Error(message)
  error.code = code
  error.status = status
  error.statusCode = status
  if (details !== undefined) error.details = details
  return error
}

const resolveTemplateBranchCode = (businessType) =>
  BUSINESS_TYPE_TEMPLATE_BRANCH_CODE[String(businessType || '').trim().toUpperCase()] || null

const sourceProductSelect = {
  id: true,
  branchId: true,
  templateProductId: true,
  name: true,
  active: true,
  mode: true,
  inventoryBehavior: true,
  saleBarcode: true,
  noSN: true,
  trackSerialNumber: true,
  codeType: true,
  productConfig: true,
  warrantyDays: true,
  productTypeId: true,
  productType: {
    select: {
      id: true,
      name: true,
      normalizedName: true,
      active: true,
      branchId: true,
      globalProductTypeId: true,
      globalProductType: {
        select: { id: true, name: true, categoryId: true },
      },
    },
  },
  brandId: true,
  brand: {
    select: { id: true, name: true, normalizedName: true, active: true, branchId: true },
  },
  unitId: true,
  unit: { select: { id: true, name: true } },
  branchPrice: {
    orderBy: [{ id: 'desc' }],
    take: 1,
    select: {
      effectiveDate: true,
      expiredDate: true,
      costPrice: true,
      priceRetail: true,
      priceWholesale: true,
      priceTechnician: true,
      priceOnline: true,
      isActive: true,
    },
  },
}

const templateMatchSelect = {
  id: true,
  name: true,
  active: true,
  productTypeId: true,
  productType: {
    select: {
      id: true,
      name: true,
      branchId: true,
      globalProductTypeId: true,
      globalProductType: { select: { id: true, name: true, categoryId: true } },
    },
  },
  brandId: true,
  brand: { select: { id: true, name: true, normalizedName: true, active: true } },
  unitId: true,
  unit: { select: { id: true, name: true } },
}

const resolveMatchingTemplateBranch = async ({ sourceBranchId, db }) => {
  const sourceBranch = await db.branch.findUnique({
    where: { id: Number(sourceBranchId) },
    select: { id: true, name: true, branchCode: true, businessType: true, categoryId: true },
  })
  if (!sourceBranch) throw makeError('SOURCE_BRANCH_NOT_FOUND', 404)

  const templateBranchCode = resolveTemplateBranchCode(sourceBranch.businessType)
  if (!templateBranchCode) {
    return {
      supported: false,
      sourceBranch,
      templateBranch: null,
      reason: 'TEMPLATE_BRANCH_MAPPING_NOT_CONFIGURED',
    }
  }

  const templateBranch = await db.branch.findFirst({
    where: { branchCode: templateBranchCode },
    select: { id: true, name: true, branchCode: true, businessType: true, categoryId: true },
    orderBy: { id: 'asc' },
  })
  if (!templateBranch) throw makeError('TEMPLATE_BRANCH_NOT_FOUND', 409)
  if (Number(templateBranch.id) === Number(sourceBranch.id)) {
    throw makeError('SOURCE_BRANCH_IS_TEMPLATE_BRANCH', 409)
  }
  if (Number(templateBranch.categoryId) !== Number(sourceBranch.categoryId)) {
    throw makeError('SOURCE_TEMPLATE_CATEGORY_MISMATCH', 409, 'Source store and Template Store category do not match', {
      sourceBranchId: sourceBranch.id,
      sourceCategoryId: sourceBranch.categoryId,
      templateBranchId: templateBranch.id,
      templateCategoryId: templateBranch.categoryId,
    })
  }

  return { supported: true, sourceBranch, templateBranch, reason: null }
}

const findSourceProduct = ({ sourceProductId, sourceBranchId, db }) =>
  db.product.findFirst({
    where: {
      id: Number(sourceProductId),
      active: true,
      OR: [
        { branchId: Number(sourceBranchId) },
        { productType: { branchId: Number(sourceBranchId) } },
      ],
    },
    select: sourceProductSelect,
  })

const findLinkedTemplateProduct = ({ templateProductId, templateBranchId, db }) => {
  if (!templateProductId) return null
  return db.product.findFirst({
    where: {
      id: Number(templateProductId),
      active: true,
      productType: { branchId: Number(templateBranchId) },
    },
    select: templateMatchSelect,
  })
}

const findExactTemplateProduct = async ({ sourceProduct, templateBranchId, db }) => {
  const sourceFingerprint = buildCatalogFingerprint(sourceProduct)
  if (!sourceFingerprint) return null

  const candidates = await db.product.findMany({
    where: {
      active: true,
      productType: {
        branchId: Number(templateBranchId),
        globalProductTypeId: Number(sourceProduct.productType.globalProductTypeId),
      },
      ...(sourceProduct.brandId ? { brandId: Number(sourceProduct.brandId) } : { brandId: null }),
    },
    select: templateMatchSelect,
    orderBy: { id: 'asc' },
  })

  return candidates.find((product) => buildCatalogFingerprint(product) === sourceFingerprint) || null
}

const assertSourceProductTypeIntegrity = (sourceProduct) => {
  const productType = sourceProduct?.productType
  const globalType = productType?.globalProductType
  if (!productType?.id || !globalType?.id || !globalType?.name) {
    throw makeError('SOURCE_PRODUCT_TYPE_AUTHORITY_MISSING', 409)
  }
  if (!isTaxonomyLabelCompatible(productType.name, globalType.name)) {
    throw makeError('PRODUCT_TYPE_GLOBAL_MAPPING_CONFLICT', 409, 'Source ProductType does not match GlobalProductType', {
      sourceProductTypeId: productType.id,
      sourceProductTypeName: productType.name,
      globalProductTypeId: globalType.id,
      globalProductTypeName: globalType.name,
    })
  }
}

const ensureTemplateProductType = async ({ sourceProduct, templateBranchId, db }) => {
  assertSourceProductTypeIntegrity(sourceProduct)

  const sourceType = sourceProduct.productType
  const globalProductTypeId = Number(sourceType.globalProductTypeId)
  const candidates = await db.productType.findMany({
    where: {
      branchId: Number(templateBranchId),
      globalProductTypeId,
    },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      active: true,
      branchId: true,
      globalProductTypeId: true,
      globalProductType: { select: { id: true, name: true, categoryId: true } },
    },
    orderBy: { id: 'asc' },
  })

  const compatible = candidates.filter((candidate) =>
    isTaxonomyLabelCompatible(candidate.name, candidate.globalProductType?.name)
  )

  if (candidates.length > 0 && compatible.length === 0) {
    throw makeError('PRODUCT_TYPE_GLOBAL_MAPPING_CONFLICT', 409, 'Template ProductType does not match GlobalProductType', {
      globalProductTypeId,
      sourceProductTypeId: sourceType.id,
      sourceProductTypeName: sourceType.name,
      templateProductTypes: candidates.map((item) => ({ id: item.id, name: item.name })),
    })
  }

  const exactName = compatible.find(
    (candidate) => normalizeCatalogText(candidate.name) === normalizeCatalogText(sourceType.name)
  )
  const existing = exactName || compatible[0] || null
  if (existing) return existing

  try {
    return await db.productType.create({
      data: {
        name: sourceType.name,
        active: sourceType.active !== false,
        normalizedName: sourceType.normalizedName || String(sourceType.name || '').trim().toLowerCase(),
        branchId: Number(templateBranchId),
        globalProductTypeId,
      },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        active: true,
        branchId: true,
        globalProductTypeId: true,
        globalProductType: { select: { id: true, name: true, categoryId: true } },
      },
    })
  } catch (error) {
    if (error?.code !== 'P2002') throw error
    const concurrent = await db.productType.findFirst({
      where: {
        branchId: Number(templateBranchId),
        globalProductTypeId,
        OR: [
          { normalizedName: sourceType.normalizedName || String(sourceType.name || '').trim().toLowerCase() },
          { name: sourceType.name },
        ],
      },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        active: true,
        branchId: true,
        globalProductTypeId: true,
        globalProductType: { select: { id: true, name: true, categoryId: true } },
      },
    })
    if (concurrent) return concurrent
    throw error
  }
}

const ensureTemplateProductTypeBrand = async ({ productTypeId, brandId, db }) => {
  if (!productTypeId || !brandId) return null
  return db.productTypeBrand.upsert({
    where: {
      productTypeId_brandId: {
        productTypeId: Number(productTypeId),
        brandId: Number(brandId),
      },
    },
    update: {},
    create: {
      productTypeId: Number(productTypeId),
      brandId: Number(brandId),
    },
  })
}

const resolveTemplateSaleBarcode = async ({ sourceProduct, templateBranchId, db }) => {
  const saleBarcode = String(sourceProduct?.saleBarcode || '').trim()
  if (!saleBarcode) return null

  const conflict = await db.product.findFirst({
    where: {
      saleBarcode,
      productType: { branchId: Number(templateBranchId) },
    },
    select: { id: true },
  })
  return conflict ? null : saleBarcode
}

const cloneSourceBranchPriceToTemplate = async ({ sourceProduct, templateProductId, templateBranchId, employeeId, role, v2Role, db }) => {
  const sourcePrice = sourceProduct?.branchPrice?.[0] || null
  if (!sourcePrice) return null

  const payload = {
    costPrice: sourcePrice.costPrice,
    priceRetail: sourcePrice.priceRetail,
    priceWholesale: sourcePrice.priceWholesale,
    priceTechnician: sourcePrice.priceTechnician,
    priceOnline: sourcePrice.priceOnline,
  }

  priceAuthorityPolicy.assertPricePayload({
    actor: {
      branchId: Number(sourceProduct?.productType?.branchId || sourceProduct?.branchId),
      employeeId: Number(employeeId),
      role,
      v2Role,
    },
    payload,
    effectiveDate: sourcePrice.effectiveDate,
    expiredDate: sourcePrice.expiredDate,
  })

  return db.branchPrice.upsert({
    where: {
      productId_branchId: {
        productId: Number(templateProductId),
        branchId: Number(templateBranchId),
      },
    },
    update: {
      ...payload,
      effectiveDate: sourcePrice.effectiveDate ?? null,
      expiredDate: sourcePrice.expiredDate ?? null,
      isActive: sourcePrice.isActive !== false,
      note: 'Reverse cloned from Store Product',
      updatedBy: Number(employeeId) || null,
    },
    create: {
      productId: Number(templateProductId),
      branchId: Number(templateBranchId),
      ...payload,
      effectiveDate: sourcePrice.effectiveDate ?? null,
      expiredDate: sourcePrice.expiredDate ?? null,
      isActive: sourcePrice.isActive !== false,
      note: 'Reverse cloned from Store Product',
      updatedBy: Number(employeeId) || null,
    },
  })
}

const linkSourceProductToTemplate = ({ sourceProductId, templateProductId, db }) =>
  db.product.update({
    where: { id: Number(sourceProductId) },
    data: { templateProductId: Number(templateProductId) },
    select: { id: true, templateProductId: true },
  })

const reverseCloneStoreProductToMatchingTemplate = async ({
  sourceBranchId,
  sourceProductId,
  employeeId,
  role,
  v2Role,
  db = prisma,
} = {}) => {
  const sourceBranch = Number(sourceBranchId)
  const sourceProduct = Number(sourceProductId)
  if (!Number.isInteger(sourceBranch) || sourceBranch <= 0) throw makeError('SOURCE_BRANCH_ID_REQUIRED', 400)
  if (!Number.isInteger(sourceProduct) || sourceProduct <= 0) throw makeError('SOURCE_PRODUCT_ID_REQUIRED', 400)

  const branchResolution = await resolveMatchingTemplateBranch({ sourceBranchId: sourceBranch, db })
  if (!branchResolution.supported) {
    return {
      success: true,
      status: 'SKIPPED',
      reason: branchResolution.reason,
      sourceBranchId: sourceBranch,
      sourceProductId: sourceProduct,
      templateBranchId: null,
      templateProductId: null,
      created: false,
    }
  }

  const templateBranchId = branchResolution.templateBranch.id

  return db.$transaction(async (tx) => {
    const product = await findSourceProduct({
      sourceProductId: sourceProduct,
      sourceBranchId: sourceBranch,
      db: tx,
    })
    if (!product) throw makeError('SOURCE_PRODUCT_NOT_FOUND', 404)

    const linkedTemplate = await findLinkedTemplateProduct({
      templateProductId: product.templateProductId,
      templateBranchId,
      db: tx,
    })
    if (linkedTemplate) {
      return {
        success: true,
        status: 'LINKED_TEMPLATE',
        reason: null,
        sourceBranchId: sourceBranch,
        sourceProductId: product.id,
        templateBranchId,
        templateProductId: linkedTemplate.id,
        created: false,
        templateProduct: linkedTemplate,
      }
    }

    const exactTemplate = await findExactTemplateProduct({
      sourceProduct: product,
      templateBranchId,
      db: tx,
    })
    if (exactTemplate) {
      await linkSourceProductToTemplate({
        sourceProductId: product.id,
        templateProductId: exactTemplate.id,
        db: tx,
      })
      return {
        success: true,
        status: 'MATCHED_UNLINKED',
        reason: null,
        sourceBranchId: sourceBranch,
        sourceProductId: product.id,
        templateBranchId,
        templateProductId: exactTemplate.id,
        created: false,
        templateProduct: exactTemplate,
      }
    }

    const templateProductType = await ensureTemplateProductType({
      sourceProduct: product,
      templateBranchId,
      db: tx,
    })
    await ensureTemplateProductTypeBrand({
      productTypeId: templateProductType.id,
      brandId: product.brandId,
      db: tx,
    })

    const saleBarcode = await resolveTemplateSaleBarcode({
      sourceProduct: product,
      templateBranchId,
      db: tx,
    })

    const templateProduct = await tx.product.create({
      data: {
        branchId: Number(templateBranchId),
        name: product.name,
        active: product.active !== false,
        mode: product.mode,
        inventoryBehavior: product.inventoryBehavior,
        saleBarcode,
        noSN: Boolean(product.noSN),
        trackSerialNumber: Boolean(product.trackSerialNumber),
        productTypeId: templateProductType.id,
        brandId: product.brandId || null,
        unitId: product.unitId || null,
        codeType: product.codeType || null,
        productConfig: product.productConfig ?? undefined,
        warrantyDays: product.warrantyDays || null,
      },
      select: templateMatchSelect,
    })

    await cloneSourceBranchPriceToTemplate({
      sourceProduct: product,
      templateProductId: templateProduct.id,
      templateBranchId,
      employeeId,
      role,
      v2Role,
      db: tx,
    })

    await linkSourceProductToTemplate({
      sourceProductId: product.id,
      templateProductId: templateProduct.id,
      db: tx,
    })

    return {
      success: true,
      status: 'REVERSE_CLONED',
      reason: null,
      sourceBranchId: sourceBranch,
      sourceProductId: product.id,
      templateBranchId,
      templateProductId: templateProduct.id,
      created: true,
      templateProduct,
    }
  }, { timeout: 15000 })
}

module.exports = {
  BUSINESS_TYPE_TEMPLATE_BRANCH_CODE,
  normalizeCatalogText,
  buildCatalogFingerprint,
  resolveTemplateBranchCode,
  resolveMatchingTemplateBranch,
  findExactTemplateProduct,
  ensureTemplateProductType,
  ensureTemplateProductTypeBrand,
  reverseCloneStoreProductToMatchingTemplate,
}
