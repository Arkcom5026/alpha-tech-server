const { prisma } = require('../../../../lib/prisma')
const { findOperationalRuntimeProductByTemplateId } = require('../../runtime/repositories/operationalProductRuntimeRepository')
const { toOperationalRuntimeProduct } = require('../../runtime/mappers/operationalRuntimeProductMapper')
const { toInt } = require('../../runtime/shared/operationalProductInput')

const requireBranchId = (branchId) => {
  const value = toInt(branchId)
  if (!value) {
    const error = new Error('BRANCH_ID_MISSING')
    error.statusCode = 401
    error.code = 'BRANCH_ID_MISSING'
    throw error
  }
  return value
}

const findOperationalProductByTemplateId = async ({ branchId, templateProductId, db = prisma } = {}) => {
  const brId = requireBranchId(branchId)
  const tplId = toInt(templateProductId)
  if (!tplId) {
    const error = new Error('TEMPLATE_PRODUCT_ID_MISSING')
    error.statusCode = 400
    error.code = 'TEMPLATE_PRODUCT_ID_MISSING'
    throw error
  }
  const product = await findOperationalRuntimeProductByTemplateId({ branchId: brId, templateProductId: tplId, db })
  const mapped = toOperationalRuntimeProduct(product)
  return {
    success: true,
    exists: !!product,
    data: mapped,
    product: mapped,
    templateProductId: tplId,
    branchId: brId,
  }
}

module.exports = { findOperationalProductByTemplateId }
