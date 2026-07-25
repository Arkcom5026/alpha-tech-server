const repository = require('../repositories/productStockModeMigrationRepository')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const makeError = (code, status) => {
  const error = new Error(code)
  error.code = code
  error.status = status
  error.statusCode = status
  return error
}

const migrateProductToSimple = async ({ productId, branchId } = {}) => {
  const id = toInt(productId)
  if (!id) throw makeError('INVALID_ID', 400)
  if (!Number(branchId)) throw makeError('unauthorized', 401)

  const product = await repository.findProductModeById({ productId: id })
  if (!product) throw makeError('NOT_FOUND', 404)
  if (product.mode === 'SIMPLE') throw makeError('ALREADY_SIMPLE', 409)

  const groups = await repository.groupInStockItemsByBranch({ productId: id })
  const result = await repository.migrateStructuredProductToSimple({
    productId: id,
    groups,
  })

  return {
    success: true,
    migratedQty: result.migratedQty,
    branches: groups.length,
  }
}

module.exports = {
  migrateProductToSimple,
}
