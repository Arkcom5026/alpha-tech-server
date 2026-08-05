const { prisma } = require('../../../../lib/prisma')
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

const cloneOperationalProductFromTemplate = async ({ branchId, templateProductId, db = prisma } = {}) => {
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

    const template = await findTemplateProductForClone({ templateProductId: tplId, templateBranchId: templateBranch.id, db: tx })
    if (!template) {
      const error = new Error('TEMPLATE_PRODUCT_NOT_FOUND')
      error.statusCode = 404
      error.code = 'TEMPLATE_PRODUCT_NOT_FOUND'
      throw error
    }

    const existing = await findOperationalRuntimeProductByTemplateId({ branchId: brId, templateProductId: tplId, db: tx })
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

    const structured = template.mode === 'STRUCTURED' || template.trackSerialNumber === true
    const created = await createOperationalProductRecordFromTemplate({
      db: tx,
      data: {
        name: template.name,
        mode: structured ? 'STRUCTURED' : 'SIMPLE',
        inventoryBehavior: template.inventoryBehavior ?? 'TRACKED',
        saleBarcode: null,
        noSN: !structured,
        trackSerialNumber: structured,
        active: true,
        categoryId: branchType.globalProductType?.categoryId ?? null,
        templateProduct: { connect: { id: tplId } },
        productType: { connect: { id: branchType.id } },
        branch: { connect: { id: brId } },
        ...(template.brandId ? { brand: { connect: { id: template.brandId } } } : {}),
        ...(template.unitId ? { unit: { connect: { id: template.unitId } } } : {}),
      },
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

module.exports = { adoptBranchProductType, cloneOperationalProductFromTemplate }
