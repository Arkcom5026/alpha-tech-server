const repository = require('../repositories/productDuplicatePreviewRepository')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : undefined
}

const makeError = (code, status) => {
  const error = new Error(code)
  error.code = code
  error.status = status
  error.statusCode = status
  return error
}

const getProductExistingModelPreview = async ({ branchId, productTypeId, brandId, take } = {}) => {
  const bId = toInt(branchId)
  const ptId = toInt(productTypeId)
  const brId = toInt(brandId)
  const takeNum = Math.max(1, Math.min(toInt(take) ?? 80, 200))

  if (!bId) throw makeError('BRANCH_ID_REQUIRED', 403)
  if (!ptId || !brId) return { items: [], total: 0 }

  const products = await repository.findExistingProductModels({
    branchId: bId,
    productTypeId: ptId,
    brandId: brId,
    take: takeNum,
  })

  const items = products
    .map((product) => ({
      id: Number(product.id),
      name: String(product.name ?? '').trim(),
    }))
    .filter((product) => product.name)

  return { items, total: items.length }
}

module.exports = {
  getProductExistingModelPreview,
}
