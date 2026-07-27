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

const cloneOperationalProductFromTemplate = async ({ branchId, templateProductId, db = prisma } = {}) => {
  const brId = requireBranchId(branchId)
  const tplId = toInt(templateProductId)
  if (!tplId) {
    const error = new Error('TEMPLATE_PRODUCT_ID_MISSING')
    error.statusCode = 400
    error.code = 'TEMPLATE_PRODUCT_ID_MISSING'
    throw error
  }
  const templateBranch = await findTemplateBranchByCode({ branchCode: 'T01', db })
  if (!templateBranch) {
    const error = new Error('TEMPLATE_BRANCH_NOT_FOUND')
    error.statusCode = 404
    error.code = 'TEMPLATE_BRANCH_NOT_FOUND'
    throw error
  }
  const template = await findTemplateProductForClone({ templateProductId: tplId, templateBranchId: templateBranch.id, db })
  if (!template) {
    const error = new Error('TEMPLATE_PRODUCT_NOT_FOUND')
    error.statusCode = 404
    error.code = 'TEMPLATE_PRODUCT_NOT_FOUND'
    throw error
  }
  const existing = await findOperationalRuntimeProductByTemplateId({ branchId: brId, templateProductId: tplId, db })
  if (existing) {
    const mapped = toOperationalRuntimeProduct(existing, brId)
    return { success: true, created: false, exists: true, data: mapped, product: mapped, templateProductId: tplId, branchId: brId, statusCode: 200 }
  }
  const branchType = await findBranchProductTypeByGlobalProductTypeId({ branchId: brId, globalProductTypeId: template.productType?.globalProductTypeId, db })
  if (!branchType) {
    const error = new Error('PRODUCT_TYPE_NOT_FOUND_IN_BRANCH')
    error.statusCode = 400
    error.code = 'PRODUCT_TYPE_NOT_FOUND_IN_BRANCH'
    throw error
  }
  const structured = template.mode === 'STRUCTURED' || template.trackSerialNumber === true
  const created = await createOperationalProductRecordFromTemplate({
    db,
    data: {
      name: template.name,
      mode: structured ? 'STRUCTURED' : 'SIMPLE',
      inventoryBehavior: template.inventoryBehavior ?? 'TRACKED',
      saleBarcode: null,
      noSN: !structured,
      trackSerialNumber: structured,
      active: true,
      templateProductId: tplId,
      productTypeId: branchType.id,
      categoryId: branchType.globalProductType?.categoryId ?? null,
      brandId: template.brandId ?? null,
      unitId: template.unitId ?? null,
    },
  })
  const runtime = await fetchOperationalRuntimeProduct(created.id, brId, db)
  const mapped = toOperationalRuntimeProduct(runtime, brId)
  return { success: true, created: true, exists: false, data: mapped, product: mapped, templateProductId: tplId, branchId: brId, statusCode: 201 }
}

module.exports = { cloneOperationalProductFromTemplate }
