'use strict'

const { BusinessType } = require('@prisma/client')
const { prisma } = require('../../../../lib/prisma')
const { DEFAULT_TEMPLATE_BRANCH_CODE } = require('../../../productTemplate/repositories/productTemplateRepository')
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

const resolveMatchingTemplateBranch = async ({ sourceBranchId, sourceProduct, db }) => {
  const sourceBranch = await db.branch.findUnique({
    where: { id: Number(sourceBranchId) },
    select: { id: true, name: true, branchCode: true, businessType: true, categoryId: true },
  })
  if (!sourceBranch) throw makeError('SOURCE_BRANCH_NOT_FOUND', 404)

  const productCategoryId = Number(sourceProduct?.productType?.globalProductType?.categoryId) || null
  if (!productCategoryId) {
    throw makeError('SOURCE_PRODUCT_GLOBAL_CATEGORY_REQUIRED', 409, 'Source Product must have GlobalProductType category authority')
  }

  const preferredBranchCode = resolveTemplateBranchCode(sourceBranch.businessType)
  const branchCodes = Array.from(
    new Set([preferredBranchCode, DEFAULT_TEMPLATE_BRANCH_CODE].filter(Boolean))
  )

  let templateBranch = null
  for (const branchCode of branchCodes) {
    templateBranch = await db.branch.findFirst({
      where: {
        branchCode,
        categoryId: productCategoryId,
      },
      select: { id: true, name: true, branchCode: true, businessType: true, categoryId: true },
      orderBy: { id: 'asc' },
    })
    if (templateBranch) break
  }

  if (!templateBranch) {
    templateBranch = await db.branch.findFirst({
      where: {
        categoryId: productCategoryId,
        branchCode: { startsWith: 'T' },
      },
      select: { id: true, name: true, branchCode: true, businessType: true, categoryId: true },
      orderBy: [{ branchCode: 'asc' }, { id: 'asc' }],
    })
  }

  if (!templateBranch) {
    return {
      supported: false,
      sourceBranch,
      templateBranch: null,
      productCategoryId,
      reason: 'TEMPLATE_BRANCH_MAPPING_NOT_CONFIGURED',
    }
  }

  if (Number(templateBranch.id) === Number(sourceBranch.id)) {
    throw makeError('SOURCE_BRANCH_IS_TEMPLATE_BRANCH', 409)
  }

  if (Number(templateBranch.categoryId) !== productCategoryId) {
    throw makeError('PRODUCT_TEMPLATE_CATEGORY_MISMATCH', 409, 'Product Global category and Template Store category do not match', {
      sourceBranchId: sourceBranch.id,
      sourceBranchCategoryId: sourceBranch.categoryId,
      productCategoryId,
      templateBranchId: templateBranch.id,
      templateCategoryId: templateBranch.categoryId,
    })
  }

  return {
    supported: true,
    sourceBranch,
    templateBranch,
    productCategoryId,
    reason: null,
  }
}

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

const buildReverseCloneLockKey = ({ sourceProduct, templateBranchId }) => {
  const fingerprint = buildCatalogFingerprint(sourceProduct)
  if (!fingerprint) throw makeError('SOURCE_PRODUCT_FINGERPRINT_REQUIRED', 409)
  return `product-template-reverse-clone:${Number(templateBranchId)}:${fingerprint}`
}

const acquireReverseCloneFingerprintLock = async ({ sourceProduct, templateBranchId, db }) => {
  const lockKey = buildReverseCloneLockKey({ sourceProduct, templateBranchId })
  // PostgreSQL returns `void` from pg_advisory_xact_lock. Cast it so Prisma can
  // deserialize the query result after the transaction-scoped lock is acquired.
  await db.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text', lockKey)
  return lockKey
}

const assertSourceProductTypeIntegrity = (sourceProduct) => {
  const productType = sourceProduct?.productType
  const globalType = productType?.globalProductType
  const globalProductTypeId = Number(productType?.globalProductTypeId) || null

  if (!productType?.id || !globalProductTypeId || !globalType?.id || !globalType?.categoryId) {
    throw makeError('SOURCE_PRODUCT_TYPE_AUTHORITY_MISSING', 409)
  }
  if (globalProductTypeId !== Number(globalType.id)) {
    throw makeError('GLOBAL_PRODUCT_TYPE_ID_MISMATCH', 409, 'Source ProductType global authority is inconsistent', {
      sourceProductTypeId: productType.id,
      sourceProductTypeName: productType.name,
      globalProductTypeId,
      resolvedGlobalProductTypeId: globalType.id,
    })
  }
}

const ensureTemplateProductType = async ({ sourceProduct, templateBranchId, db }) => {
  assertSourceProductTypeIntegrity(sourceProduct)

  const sourceType = sourceProduct.productType
  const globalProductTypeId = Number(sourceType.globalProductTypeId)
  const sourceNormalizedName = sourceType.normalizedName || String(sourceType.name || '').trim().toLowerCase()
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

  const existing = candidates.find(
    (candidate) =>
      normalizeCatalogText(candidate.name) === normalizeCatalogText(sourceType.name) ||
      normalizeCatalogText(candidate.normalizedName) === normalizeCatalogText(sourceNormalizedName)
  ) || null
  if (existing) return existing

  try {
    return await db.productType.create({
      data: {
        name: sourceType.name,
        active: sourceType.active !== false,
        normalizedName: sourceNormalizedName,
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
          { normalizedName: sourceNormalizedName },
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

const assertReverseClonePriceSnapshot = ({ actor, payload = {}, effectiveDate, expiredDate }) => {
  priceAuthorityPolicy.assertMutationAuthority({ actor, payload })

  for (const field of priceAuthorityPolicy.touchedPriceFields(payload)) {
    const value = payload[field]
    if (value === undefined || value === null) continue
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) {
      throw makeError('INVALID_PRICE_VALUE', 400, `ราคา ${field} ไม่ถูกต้อง`, { field, value })
    }
    if (numeric < 0) {
      throw makeError('NEGATIVE_PRICE_NOT_ALLOWED', 400, `ราคา ${field} ต้องไม่ติดลบ`, { field, value })
    }
    // Zero is intentionally valid only on this reverse-clone snapshot path.
    // It preserves an existing Store BranchPrice exactly; it is not a new price-entry decision.
  }

  const effective = effectiveDate ? new Date(effectiveDate) : null
  const expired = expiredDate ? new Date(expiredDate) : null
  if (effective && Number.isNaN(effective.getTime())) throw makeError('INVALID_PRICE_EFFECTIVE_DATE', 400)
  if (expired && Number.isNaN(expired.getTime())) throw makeError('INVALID_PRICE_EXPIRED_DATE', 400)
  if (effective && expired && expired < effective) {
    throw makeError('INVALID_PRICE_DATE_RANGE', 400, 'expiredDate ต้องไม่เร็วกว่าหรือก่อน effectiveDate')
  }
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

  assertReverseClonePriceSnapshot({
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

  const routingProduct = await findSourceProduct({
    sourceProductId: sourceProduct,
    sourceBranchId: sourceBranch,
    db,
  })
  if (!routingProduct) throw makeError('SOURCE_PRODUCT_NOT_FOUND', 404)

  const branchResolution = await resolveMatchingTemplateBranch({
    sourceBranchId: sourceBranch,
    sourceProduct: routingProduct,
    db,
  })
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
    const initialProduct = await findSourceProduct({
      sourceProductId: sourceProduct,
      sourceBranchId: sourceBranch,
      db: tx,
    })
    if (!initialProduct) throw makeError('SOURCE_PRODUCT_NOT_FOUND', 404)

    const initialLinkedTemplate = await findLinkedTemplateProduct({
      templateProductId: initialProduct.templateProductId,
      templateBranchId,
      db: tx,
    })
    if (initialLinkedTemplate) {
      return {
        success: true,
        status: 'LINKED_TEMPLATE',
        reason: null,
        sourceBranchId: sourceBranch,
        sourceProductId: initialProduct.id,
        templateBranchId,
        templateProductId: initialLinkedTemplate.id,
        created: false,
        templateProduct: initialLinkedTemplate,
      }
    }

    await acquireReverseCloneFingerprintLock({
      sourceProduct: initialProduct,
      templateBranchId,
      db: tx,
    })

    const product = await findSourceProduct({
      sourceProductId: sourceProduct,
      sourceBranchId: sourceBranch,
      db: tx,
    })
    if (!product) throw makeError('SOURCE_PRODUCT_NOT_FOUND', 404)

    const lockedCategoryId = Number(product?.productType?.globalProductType?.categoryId) || null
    if (lockedCategoryId !== Number(branchResolution.productCategoryId)) {
      throw makeError('SOURCE_PRODUCT_CATEGORY_CHANGED_DURING_SYNC', 409)
    }

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
  buildReverseCloneLockKey,
  acquireReverseCloneFingerprintLock,
  resolveTemplateBranchCode,
  resolveMatchingTemplateBranch,
  findExactTemplateProduct,
  ensureTemplateProductType,
  ensureTemplateProductTypeBrand,
  assertReverseClonePriceSnapshot,
  reverseCloneStoreProductToMatchingTemplate,
}
