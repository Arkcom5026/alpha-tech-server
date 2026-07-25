// src/modules/product/create/services/productCreateCompatibilityService.js

const productCreateService = require('./productCreateService')

const toLegacyOperationalProductPayload = (result) => {
  const product = result?.product || null
  const branchPrice = result?.branchPrice || null

  if (!product) return result

  const mapped = {
    ...product,
    costPrice: Number(branchPrice?.costPrice ?? 0),
    priceRetail: Number(branchPrice?.priceRetail ?? 0),
    priceWholesale: Number(branchPrice?.priceWholesale ?? 0),
    priceTechnician: Number(branchPrice?.priceTechnician ?? 0),
    priceOnline: Number(branchPrice?.priceOnline ?? 0),
    branchPriceActive: branchPrice?.isActive ?? true,
    hasPrice: !!branchPrice,
    branchPrice: branchPrice ? [branchPrice] : [],
    available: 0,
    stockBalance: null,
    templateProductId: null,
    isTemplateProduct: false,
    isOperationalProduct: true,
    categoryId: product.productType?.globalProductType?.categoryId ?? null,
    categoryName: product.productType?.globalProductType?.category?.name ?? null,
    category: product.productType?.globalProductType?.category?.name ?? '-',
    productTypeName: product.productType?.name ?? '-',
  }

  return {
    success: true,
    created: true,
    data: mapped,
    product: mapped,
    branchId: result?.runtime?.branchId ?? null,
  }
}

const createLocalOperationalProductForLegacyRuntime = async ({ branchId, employeeId, data = {} } = {}) => {
  const result = await productCreateService.createLocalOperationalProduct({
    branchId,
    employeeId,
    data,
  })

  return toLegacyOperationalProductPayload(result)
}

module.exports = {
  createLocalOperationalProductForLegacyRuntime,
  toLegacyOperationalProductPayload,
}
