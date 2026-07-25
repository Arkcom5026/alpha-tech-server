// src/modules/product/delete/controllers/productDeleteController.js

const productDeleteService = require('../services/productDeleteService')

const sendError = (res, error) => {
  const status = error?.status || error?.statusCode || 500
  const payload = {
    ok: false,
    error: error?.code || 'Internal server error',
  }

  if (error?.message && error.message !== error.code) payload.message = error.message
  if (error?.reason) payload.reason = error.reason
  if (error?.counts) payload.counts = error.counts

  return res.status(status).json(payload)
}

const getDeleteCheck = async (req, res) => {
  try {
    const result = await productDeleteService.getDeleteCheck({
      productId: req.params.id,
      role: req.user?.role,
    })
    return res.json(result)
  } catch (error) {
    return sendError(res, error)
  }
}

const deleteProduct = async (req, res) => {
  try {
    const result = await productDeleteService.deleteProduct({
      productId: req.params.id,
      role: req.user?.role,
    })
    return res.json(result)
  } catch (error) {
    return sendError(res, error)
  }
}

module.exports = {
  getDeleteCheck,
  deleteProduct,
}
