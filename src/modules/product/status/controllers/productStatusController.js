// src/modules/product/status/controllers/productStatusController.js

const productStatusService = require('../services/productStatusService')

const sendError = (res, error) => {
  const status = error?.status || error?.statusCode || 500
  if (status >= 500) console.error('❌ productStatus runtime error:', error)

  return res.status(status).json({
    ok: false,
    error: error?.code || error?.message || 'PRODUCT_STATUS_RUNTIME_ERROR',
    ...(error?.message ? { message: error.message } : {}),
  })
}

const disableProduct = async (_req, res) => {
  try {
    await productStatusService.disableProduct()
    return undefined
  } catch (error) {
    return sendError(res, error)
  }
}

const enableProduct = async (_req, res) => {
  try {
    await productStatusService.enableProduct()
    return undefined
  } catch (error) {
    return sendError(res, error)
  }
}

const archiveProduct = async (req, res) => {
  try {
    const product = await productStatusService.archiveProduct({
      productId: req.params.id,
      role: req.user?.role,
    })

    return res.json({ ok: true, success: true, product })
  } catch (error) {
    return sendError(res, error)
  }
}

module.exports = {
  disableProduct,
  enableProduct,
  archiveProduct,
}
