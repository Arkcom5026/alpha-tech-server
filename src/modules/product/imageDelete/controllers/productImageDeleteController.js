// src/modules/product/imageDelete/controllers/productImageDeleteController.js

const productImageDeleteService = require('../services/productImageDeleteService')

const deleteProductImage = async (req, res) => {
  try {
    const result = await productImageDeleteService.deleteProductImage({
      productId: req.params.id,
      branchId: req.user?.branchId,
      publicId: req.body?.public_id,
    })

    return res.json(result)
  } catch (error) {
    const status = error?.status || error?.statusCode || 500
    if (status >= 500) console.error('❌ productImageDelete runtime error:', error)
    return res.status(status).json({
      error: error?.code || error?.message || 'Internal server error',
    })
  }
}

module.exports = { deleteProductImage }
