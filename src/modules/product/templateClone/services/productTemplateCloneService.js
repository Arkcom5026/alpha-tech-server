const { prisma } = require('../../../../lib/prisma')
const priceAuthorityPolicy = require('../../pricing/policies/priceAuthorityPolicy')
const {
  createOperationalProductRecordFromTemplate,
  fetchOperationalRuntimeProduct,
  findOperationalRuntimeProductByTemplateId,
  findTemplateBranchByCode,
  findTemplateProductForClone,
} = require('../../runtime/repositories/operationalProductRuntimeRepository')
const { toOperationalRuntimeProduct } = require('../../runtime/mappers/operationalRuntimeProductMapper')
const { toInt } = require('../../runtime/shared/operationalProductInput')

const requireBranchId = (branchId) => {
  const id = toInt(branchId)
  if (!id) {
    const error = new Error('BRANCH_ID_MISSING')
    error.statusCode = 401
    error.code = 'BRANCH_ID_MISSING'
    throw error
  }
  return id
}

const normalizeTaxonomyLabel = (value) =>
  String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('th-TH')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/และ/gu, ' ')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeProductTypeIdentity = (value) =>
  String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('th-TH')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '')

const isTaxonomyLabelCompatible = (left, right) => {
  const a = normalizeTaxonomyLabel(left)
  const b = normalizeTaxonomyLabel(right)
  if (!a || !b) return false
  if (a === b) return true

  const shorter = a.length <= b.length ? a : b
  const longer = a.length > b.length ? a : b
  return shorter.length >= 4 && longer.includes(shorter)
}

const mappingConflict = ({ templateType, branchType, globalProductTypeId, globalName, reason, existingProduct }) => {
  const error = new Error('PRODUCT_TYPE_GLOBAL_MAPPING_CONFLICT')
  error.statusCode = 409
  error.code = 'PRODUCT_TYPE_GLOBAL_MAPPING_CONFLICT'
  error.details = {
    reason,
    globalProductTypeId: Number(globalProductTypeId) || null,
    globalProductTypeName: globalName || null,
    templateProductTypeId: Number(templateType?.id) || null,
    templateProductTypeName: templateType?.name || null,
    branchProductTypeId: Number(branchType?.id) || null,
    branchProductTypeName: branchType?.name || null,
    existingProductId: Number(existingProduct?.id) || null,
    existingProductTypeId: Number(existingProduct?.productTypeId) || null,
    existingProductTypeName: existingProduct?.productType?.name || null,
  }
  return error
}

const assertProductTypeGlobalMappingIntegrity = ({ templateType, branchType, globalProductTypeId }) => {
  const templateGlobal = templateType?.globalProductType
  const branchGlobal = branchType?.globalProductType
  const globalName = templateGlobal?.name || branchGlobal?.name || ''

  if (!templateType || !branchType || !templateGlobal?.id || !branchGlobal?.id) {
    throw mappingConflict({
      templateType,
      branchType,
      globalProductTypeId,
      globalName,
      reason: 'GLOBAL_PRODUCT_TYPE_AUTHORITY_MISSING',
    })
  }

  if (
    Number(templateType.globalProductTypeId) !== Number(globalProductTypeId) ||
    Number(branchType.globalProductTypeId) !== Number(globalProductTypeId) ||
    Number(templateGlobal.id) !== Number(globalProductTypeId) ||
    Number(branchGlobal.id) !== Number(globalProductTypeId)
  ) {
    throw mappingConflict({
      templateType,
      branchType,
      globalProductTypeId,
      globalName,
      reason: 'GLOBAL_PRODUCT_TYPE_ID_MISMATCH',
    })
  }

  return true
}

const assertExistingTemplateTraceProductType = ({ existingProduct, branchType, templateType, globalProductTypeId }) => {
  if (!existingProduct) return true
  if (Number(existingProduct.productTypeId) === Number(branchType?.id)) return true

  throw mappingConflict({
    templateType,
    branchType,
    globalProductTypeId,
    globalName: templateType?.globalProductType?.name || branchType?.globalProductType?.name || '',
    reason: 'EXISTING_TEMPLATE_TRACE_PRODUCT_TYPE_MISMATCH',
    existingProduct,
  })
}

const selectTypeIntegrityFields = {
  id: true,
  name: true,
  normalizedName: true,
  active: true,
  branchId: true,
  globalProductTypeId: true,
  globalProductType: {
    select: {
      id: true,
      name: true,
      categoryId: true,
    },
  },
}

const adoptBranchProductType = async ({
  branchId,
  templateBranchId,
  templateProductTypeId,
  globalProductTypeId,
  db,
}) => {
  const templateType = await db.productType.findFirst({
    where: {
      id: Number(templateProductTypeId),
      branchId: Number(templateBranchId),
      globalProductTypeId: Number(globalProductTypeId),
    },
    select: selectTypeIntegrityFields,
  })

  if (!templateType) {
    const error = new Error('TEMPLATE_PRODUCT_TYPE_NOT_FOUND')
    error.statusCode = 404
    error.code = 'TEMPLATE_PRODUCT_TYPE_NOT_FOUND'
    throw error
  }

  const identity = normalizeProductTypeIdentity(templateType.normalizedName || templateType.name)
  const candidates = await db.productType.findMany({
    where: {
      branchId: Number(branchId),
      globalProductTypeId: Number(globalProductTypeId),
    },
    select: selectTypeIntegrityFields,
    orderBy: { id: 'asc' },
  })

  const existing = candidates.find((candidate) => {
    const candidateIdentity = normalizeProductTypeIdentity(candidate.normalizedName || candidate.name)
    return identity && candidateIdentity === identity
  }) || null

  if (existing) {
    assertProductTypeGlobalMappingIntegrity({
      templateType,
      branchType: existing,
      globalProductTypeId,
    })
    return { templateType, branchType: existing }
  }

  try {
    const created = await db.productType.create({
      data: {
        branchId: Number(branchId),
        globalProductTypeId: templateType.globalProductTypeId,
        name: templateType.name,
        normalizedName: templateType.normalizedName || String(templateType.name || '').trim().toLocaleLowerCase('th-TH'),
        active: templateType.active !== false,
      },
      select: selectTypeIntegrityFields,
    })

    assertProductTypeGlobalMappingIntegrity({
      templateType,
      branchType: created,
      globalProductTypeId,
    })
    return { templateType, branchType: created }
  } catch (error) {
    if (error?.code !== 'P2002') throw error

    const concurrentCandidates = await db.productType.findMany({
      where: {
        branchId: Number(branchId),
        globalProductTypeId: Number(globalProductTypeId),
      },
      select: selectTypeIntegrityFields,
      orderBy: { id: 'asc' },
    })
    const concurrent = concurrentCandidates.find((candidate) =>
      normalizeProductTypeIdentity(candidate.normalizedName || candidate.name) === identity
    ) || null

    if (concurrent) {
      assertProductTypeGlobalMappingIntegrity({
        templateType,
        branchType: concurrent,
        globalProductTypeId,
      })
      return { templateType, branchType: concurrent }
    }
    throw error
  }
}

const fetchTemplateCloneDefaults = ({ templateProductId, templateBranchId, db }) => (
  db.product.findFirst({
    where: {
      id: Number(templateProductId),
      active: true,
      productType: { branchId: Number(templateBranchId) },
    },
    select: {
      productImages: {
        where: { active: true },
        orderBy: [{ isCover: 'desc' }, { id: 'asc' }],
        select: {
          url: true,
          public_id: true,
          secure_url: true,
          caption: true,
          isCover: true,
          active: true,
        },
      },
      branchPrice: {
        where: { branchId: Number(templateBranchId) },
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
    },
  })
)

const ensureSelectedBrandMapping = async ({ productTypeId, brandId, db }) => {
  const typeId = toInt(productTypeId)
  const selectedBrandId = toInt(brandId)
  if (!typeId || !selectedBrandId) return

  try {
    await db.productTypeBrand.create({
      data: {
        productTypeId: typeId,
        brandId: selectedBrandId,
      },
    })
  } catch (error) {
    if (error?.code === 'P2002') return
    throw error
  }
}

const resolveCloneSaleBarcode = async ({ branchId, template, db }) => {
  const structured = template.mode === 'STRUCTURED' || template.trackSerialNumber === true
  if (structured) return null

  const saleBarcode = String(template.saleBarcode || '').trim()
  if (!saleBarcode) return null

  const conflict = await db.product.findFirst({
    where: {
      saleBarcode,
      productType: { branchId: Number(branchId) },
    },
    select: { id: true },
  })

  return conflict ? null : saleBarcode
}

const cloneTemplateBranchPrice = async ({
  productId,
  branchId,
  employeeId,
  role,
  v2Role,
  sourcePrice,
  db,
}) => {
  if (!sourcePrice) return null

  const costPrice = Number(sourcePrice.costPrice)
  const priceRetail = Number(sourcePrice.priceRetail)
  if (!Number.isFinite(costPrice) || costPrice <= 0 || !Number.isFinite(priceRetail) || priceRetail <= 0) {
    return null
  }

  const authority = priceAuthorityPolicy.assertPricePayload({
    actor: {
      branchId,
      employeeId: toInt(employeeId),
      role,
      v2Role,
    },
    payload: {
      costPrice: sourcePrice.costPrice,
      priceRetail: sourcePrice.priceRetail,
      priceWholesale: sourcePrice.priceWholesale,
      priceTechnician: sourcePrice.priceTechnician,
      priceOnline: sourcePrice.priceOnline,
    },
    effectiveDate: sourcePrice.effectiveDate,
    expiredDate: sourcePrice.expiredDate,
  })

  return db.branchPrice.create({
    data: {
      productId: Number(productId),
      branchId: authority.branchId,
      effectiveDate: sourcePrice.effectiveDate ?? null,
      expiredDate: sourcePrice.expiredDate ?? null,
      note: 'Cloned from Product Template',
      updatedBy: authority.employeeId,
      isActive: sourcePrice.isActive !== false,
      costPrice: sourcePrice.costPrice,
      priceRetail: sourcePrice.priceRetail,
      priceWholesale: sourcePrice.priceWholesale ?? null,
      priceTechnician: sourcePrice.priceTechnician ?? null,
      priceOnline: sourcePrice.priceOnline ?? null,
    },
  })
}

const cloneOperationalProductFromTemplate = async ({
  branchId,
  templateProductId,
  employeeId = null,
  role,
  v2Role,
  db = prisma,
} = {}) => {
  const brId = requireBranchId(branchId)
  const tplId = toInt(templateProductId)
  if (!tplId) {
    const error = new Error('TEMPLATE_PRODUCT_ID_MISSING')
    error.statusCode = 400
    error.code = 'TEMPLATE_PRODUCT_ID_MISSING'
    throw error
  }

  return db.$transaction(async (tx) => {
    const templateBranch = await findTemplateBranchByCode({ branchCode: 'T01', db: tx })
    if (!templateBranch) {
      const error = new Error('TEMPLATE_BRANCH_NOT_FOUND')
      error.statusCode = 404
      error.code = 'TEMPLATE_BRANCH_NOT_FOUND'
      throw error
    }

    if (Number(templateBranch.id) === Number(brId)) {
      const error = new Error('TARGET_BRANCH_CANNOT_BE_TEMPLATE_BRANCH')
      error.statusCode = 400
      error.code = 'TARGET_BRANCH_CANNOT_BE_TEMPLATE_BRANCH'
      throw error
    }

    const template = await findTemplateProductForClone({
      templateProductId: tplId,
      templateBranchId: templateBranch.id,
      db: tx,
    })
    if (!template) {
      const error = new Error('TEMPLATE_PRODUCT_NOT_FOUND')
      error.statusCode = 404
      error.code = 'TEMPLATE_PRODUCT_NOT_FOUND'
      throw error
    }

    const globalProductTypeId = template.productType?.globalProductTypeId
    const templateProductTypeId = template.productType?.id
    if (!globalProductTypeId || !templateProductTypeId) {
      const error = new Error('TEMPLATE_PRODUCT_TYPE_NOT_FOUND')
      error.statusCode = 404
      error.code = 'TEMPLATE_PRODUCT_TYPE_NOT_FOUND'
      throw error
    }

    const { templateType, branchType } = await adoptBranchProductType({
      branchId: brId,
      templateBranchId: templateBranch.id,
      templateProductTypeId,
      globalProductTypeId,
      db: tx,
    })

    const existing = await findOperationalRuntimeProductByTemplateId({
      branchId: brId,
      templateProductId: tplId,
      db: tx,
    })
    if (existing) {
      assertExistingTemplateTraceProductType({
        existingProduct: existing,
        branchType,
        templateType,
        globalProductTypeId,
      })

      const mapped = toOperationalRuntimeProduct(existing, brId)
      return {
        success: true,
        created: false,
        exists: true,
        data: mapped,
        product: mapped,
        templateProductId: tplId,
        branchId: brId,
        statusCode: 200,
      }
    }

    await ensureSelectedBrandMapping({
      productTypeId: branchType.id,
      brandId: template.brandId,
      db: tx,
    })

    const defaults = await fetchTemplateCloneDefaults({
      templateProductId: tplId,
      templateBranchId: templateBranch.id,
      db: tx,
    })

    const structured = template.mode === 'STRUCTURED' || template.trackSerialNumber === true
    const saleBarcode = await resolveCloneSaleBarcode({
      branchId: brId,
      template,
      db: tx,
    })

    const productImages = Array.isArray(defaults?.productImages)
      ? defaults.productImages.filter((image) => image?.url || image?.secure_url)
      : []

    const created = await createOperationalProductRecordFromTemplate({
      db: tx,
      data: {
        name: template.name,
        mode: structured ? 'STRUCTURED' : 'SIMPLE',
        inventoryBehavior: template.inventoryBehavior ?? 'TRACKED',
        saleBarcode,
        noSN: !structured,
        trackSerialNumber: structured,
        active: true,
        templateProduct: { connect: { id: tplId } },
        productType: { connect: { id: branchType.id } },
        branch: { connect: { id: brId } },
        ...(template.brandId ? { brand: { connect: { id: template.brandId } } } : {}),
        ...(template.unitId ? { unit: { connect: { id: template.unitId } } } : {}),
        ...(productImages.length
          ? {
              productImages: {
                create: productImages.map((image) => ({
                  url: image.url,
                  public_id: image.public_id,
                  secure_url: image.secure_url,
                  caption: image.caption || null,
                  isCover: !!image.isCover,
                  active: image.active !== false,
                })),
              },
            }
          : {}),
      },
    })

    await cloneTemplateBranchPrice({
      productId: created.id,
      branchId: brId,
      employeeId,
      role,
      v2Role,
      sourcePrice: defaults?.branchPrice?.[0] || null,
      db: tx,
    })

    const runtime = await fetchOperationalRuntimeProduct(created.id, brId, tx)
    const mapped = toOperationalRuntimeProduct(runtime, brId)
    return {
      success: true,
      created: true,
      exists: false,
      data: mapped,
      product: mapped,
      templateProductId: tplId,
      branchId: brId,
      statusCode: 201,
    }
  }, { timeout: 15000 })
}

module.exports = {
  normalizeTaxonomyLabel,
  normalizeProductTypeIdentity,
  isTaxonomyLabelCompatible,
  assertProductTypeGlobalMappingIntegrity,
  assertExistingTemplateTraceProductType,
  adoptBranchProductType,
  fetchTemplateCloneDefaults,
  ensureSelectedBrandMapping,
  resolveCloneSaleBarcode,
  cloneTemplateBranchPrice,
  cloneOperationalProductFromTemplate,
}
