// src/modules/product/pricing/controllers/productPricingController.js

const productPricingService = require('../services/productPricingService')

const sendError = (res, error) => {
  const status = error?.status || error?.statusCode || 500
  if (status >= 500) console.error('❌ productPricing runtime error:', error)
  return res.status(status).json({
    ok: false,
    error: error?.code || error?.message || 'PRODUCT_PRICING_RUNTIME_ERROR',
  })
}

const getProductPrices = async (req, res) => {
  try {
    const result = await productPricingService.getProductPrices({
      productId: req.params.productId,
      branchId: req.user?.branchId,
    })
    return res.json(result)
  } catch (error) {
    return sendError(res, error)
  }
}

const updateProductPrices = async (req, res) => {
  try {
    const result = await productPricingService.updateProductPrices({
      productId: req.params.productId,
      branchId: req.user?.branchId,
      data: req.body || {},
    })
    return res.json(result)
  } catch (error) {
    return sendError(res, error)
  }
}

const addProductPrice = async (req, res) => {
  try {
    const result = await productPricingService.addProductPrice({
      productId: req.params.productId,
      branchId: req.user?.branchId,
      data: req.body || {},
    })
    return res.status(201).json(result)
  } catch (error) {
    return sendError(res, error)
  }
}

const deleteProductPrice = async (req, res) => {
  try {
    const result = await productPricingService.deleteProductPrice({
      productId: req.params.productId,
      priceId: req.params.priceId,
      branchId: req.user?.branchId,
    })
    return res.json(result)
  } catch (error) {
    return sendError(res, error)
  }
}

module.exports = {
  getProductPrices,
  updateProductPrices,
  addProductPrice,
  deleteProductPrice,
}
