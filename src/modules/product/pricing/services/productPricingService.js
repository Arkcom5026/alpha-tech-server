// src/modules/product/pricing/services/productPricingService.js

const repository = require('../repositories/productPricingRepository')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const toMoney = (value, fallback = undefined) => {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(typeof value === 'string' ? value.trim().replace(/,/g, '') : value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const makeError = (code, status, message = code) => {
  const error = new Error(message)
  error.code = code
  error.status = status
  error.statusCode = status
  return error
}

const requireContext = ({ productId, branchId }) => {
  const id = toInt(productId)
  const brId = toInt(branchId)
  if (!id) throw makeError('INVALID_PRODUCT_ID', 400)
  if (!brId) throw makeError('unauthorized', 401)
  return { id, brId }
}

const ensureBranchProduct = async ({ productId, branchId }) => {
  const product = await repository.findBranchProduct({ productId, branchId })
  if (!product) throw makeError('NOT_FOUND', 404)
  return product
}

const normalizePayload = (data = {}, { forCreate = false } = {}) => ({
  costPrice: toMoney(data.costPrice, forCreate ? 0 : undefined),
  priceWholesale: toMoney(data.priceWholesale, forCreate ? 0 : undefined),
  priceTechnician: toMoney(data.priceTechnician, forCreate ? 0 : undefined),
  priceRetail: toMoney(data.priceRetail, forCreate ? 0 : undefined),
  priceOnline: toMoney(data.priceOnline, forCreate ? 0 : undefined),
  effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : undefined,
  expiredDate: data.expiredDate ? new Date(data.expiredDate) : undefined,
  note: data.note === undefined ? undefined : data.note,
  updatedBy: toInt(data.updatedBy),
  isActive: typeof data.isActive === 'boolean' ? data.isActive : forCreate ? true : undefined,
})

const getProductPrices = async ({ productId, branchId } = {}) => {
  const { id, brId } = requireContext({ productId, branchId })
  await ensureBranchProduct({ productId: id, branchId: brId })
  const price = await repository.findBranchPrice({ productId: id, branchId: brId })
  return price ? [price] : []
}

const updateProductPrices = async ({ productId, branchId, data = {} } = {}) => {
  const { id, brId } = requireContext({ productId, branchId })
  await ensureBranchProduct({ productId: id, branchId: brId })
  return repository.upsertBranchPrice({
    productId: id,
    branchId: brId,
    data: normalizePayload(data, { forCreate: true }),
  })
}

const addProductPrice = async ({ productId, branchId, data = {} } = {}) => {
  const { id, brId } = requireContext({ productId, branchId })
  await ensureBranchProduct({ productId: id, branchId: brId })
  return repository.upsertBranchPrice({
    productId: id,
    branchId: brId,
    data: normalizePayload(data, { forCreate: true }),
  })
}

const deleteProductPrice = async ({ productId, priceId, branchId } = {}) => {
  const { id, brId } = requireContext({ productId, branchId })
  const parsedPriceId = toInt(priceId)
  if (!parsedPriceId) throw makeError('INVALID_PRICE_ID', 400)
  await ensureBranchProduct({ productId: id, branchId: brId })
  const result = await repository.deleteBranchPrice({
    priceId: parsedPriceId,
    productId: id,
    branchId: brId,
  })
  if (!result?.count) throw makeError('NOT_FOUND', 404)
  return { success: true }
}

module.exports = {
  getProductPrices,
  updateProductPrices,
  addProductPrice,
  deleteProductPrice,
}
