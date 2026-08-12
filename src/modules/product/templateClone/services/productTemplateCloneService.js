const { prisma } = require('../../../../lib/prisma')
const priceAuthorityPolicy = require('../../pricing/policies/priceAuthorityPolicy')
const {
  createOperationalProductRecordFromTemplate,
  fetchOperationalRuntimeProduct,
  findBranchProductTypeByGlobalProductTypeId,
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

const adoptBranchProductType = async ({ branchId, templateBranchId, globalProductTypeId, db }) => {
  const existing = await findBranchProductTypeByGlobalProductTypeId({ branchId, globalProductTypeId, db })
  if (existing) return existing

  const templateType = await db.productType.findFirst({
    where: {
      branchId: Number(templateBranchId),
      globalProductTypeId: Number(globalProductTypeId),
    },
    select: {
      name: true,
      active: true,
      globalProductTypeId: true,
      globalProductType: { select: { categoryId: true } },
    },
  })

  if (!templateType) {
    const error = new Error('TEMPLATE_PRODUCT_TYPE_NOT_FOUND')
    error.statusCode = 404
    error.code = 'TEMPLATE_PRODUCT_TYPE_NOT_FOUND'
    throw error
  }

  try {
    return await db.productType.create({
      data: {
        branchId: Number(branchId),
        globalProductTypeId: templateType.globalProductTypeId,
        name: templateType.name,
        active: templateType.active !== false,
      },
      select: {
        id: true,
        globalProductType: { select: { categoryId: true } },
      },
    })
  } catch (error) {
    if (error?.code !== 'P2002') throw error
    const concurrent = await findBranchProductTypeByGlobalProductTypeId({ branchId, globalProductTypeId, db })
    if (concurrent) return concurrent
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

    const existing = await findOperationalRuntimeProductByTemplateId({
      branchId: brId,
      templateProductId: tplId,
      db: tx,
    })
    if (existing) {
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

    const globalProductTypeId = template.productType?.globalProductTypeId
    if (!globalProductTypeId) {
      const error = new Error('TEMPLATE_PRODUCT_TYPE_NOT_FOUND')
      error.statusCode = 404
      error.code = 'TEMPLATE_PRODUCT_TYPE_NOT_FOUND'
      throw error
    }

    const branchType = await adoptBranchProductType({
      branchId: brId,
      templateBranchId: templateBranch.id,
      globalProductTypeId,
      db: tx,
    })

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
  adoptBranchProductType,
  fetchTemplateCloneDefaults,
  ensureSelectedBrandMapping,
  resolveCloneSaleBarcode,
  cloneTemplateBranchPrice,
  cloneOperationalProductFromTemplate,
}
