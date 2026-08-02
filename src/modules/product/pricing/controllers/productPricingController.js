const productPricingService = require('../services/productPricingService')

const getBranchId = (req) => req.employee?.branchId || req.user?.branchId || req.branchId
const getEmployeeId = (req) => req.employee?.id || req.user?.employeeId || null
const getRole = (req) => req.employee?.v2Role || req.user?.role || req.user?.v2Role || null

const sendError = (res, error, fallback = 'PRODUCT_PRICING_ERROR') => {
  const status = error?.status || error?.statusCode || 500
  if (status >= 500) console.error('❌ productPricing error:', error)
  return res.status(status).json({
    ok: false,
    success: false,
    error: error?.code || fallback,
    code: error?.code || fallback,
    message: error?.message || fallback,
    ...(error?.detail !== undefined ? { detail: error.detail } : {}),
  })
}

const actorFromRequest = (req) => ({
  branchId: getBranchId(req),
  employeeId: getEmployeeId(req),
  role: getRole(req),
})

const getProductPrices = async (req, res) => {
  try {
    const result = await productPricingService.listPrices({
      productId: req.params.productId,
      branchId: getBranchId(req),
    })
    return res.json(result)
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_LOAD_PRODUCT_PRICES')
  }
}

const updateProductPrices = async (req, res) => {
  try {
    const result = await productPricingService.savePrice({
      productId: req.params.productId,
      actor: actorFromRequest(req),
      data: req.body || {},
      requireCorePrices: false,
    })
    return res.json(result)
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_UPDATE_PRODUCT_PRICE')
  }
}

const addProductPrice = async (req, res) => {
  try {
    const result = await productPricingService.savePrice({
      productId: req.params.productId,
      actor: actorFromRequest(req),
      data: req.body || {},
      requireCorePrices: true,
    })
    return res.status(201).json(result)
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_ADD_PRODUCT_PRICE')
  }
}

const deleteProductPrice = async (req, res) => {
  try {
    const result = await productPricingService.removePrice({
      productId: req.params.productId,
      priceId: req.params.priceId,
      actor: actorFromRequest(req),
    })
    return res.json(result)
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_DELETE_PRODUCT_PRICE')
  }
}

module.exports = {
  getProductPrices,
  updateProductPrices,
  addProductPrice,
  deleteProductPrice,
}
