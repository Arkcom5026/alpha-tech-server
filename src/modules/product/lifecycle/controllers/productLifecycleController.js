const service = require('../services/productLifecycleService')

const sendError = (res, error) => {
  const status = error?.status || error?.statusCode || 500
  const payload = {
    ok: false,
    error: error?.code || 'Internal server error',
  }

  if (error?.message && error.message !== error?.code) payload.message = error.message
  if (error?.details?.reason) payload.reason = error.details.reason
  if (error?.details?.counts) payload.counts = error.details.counts

  return res.status(status).json(payload)
}

const disableProduct = async (_req, res) => {
  try {
    service.refuseActivationChange()
  } catch (error) {
    return sendError(res, error)
  }
}

const enableProduct = async (_req, res) => {
  try {
    service.refuseActivationChange()
  } catch (error) {
    return sendError(res, error)
  }
}

const getProductDeleteCheck = async (req, res) => {
  try {
    const result = await service.getDeleteCheck({
      productId: req.params.id,
      role: req.user?.role,
    })
    return res.json(result)
  } catch (error) {
    return sendError(res, error)
  }
}

const archiveProduct = async (req, res) => {
  try {
    const result = await service.archiveProduct({
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
    const result = await service.hardDeleteProduct({
      productId: req.params.id,
      role: req.user?.role,
    })
    return res.json(result)
  } catch (error) {
    return sendError(res, error)
  }
}

module.exports = {
  disableProduct,
  enableProduct,
  getProductDeleteCheck,
  archiveProduct,
  deleteProduct,
}
