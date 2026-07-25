const productMediaService = require('../services/productMediaService')

const deleteProductImage = async (req, res) => {
  try {
    const result = await productMediaService.deleteProductImage({
      productId: req.params.id,
      branchId: req.user?.branchId,
      publicId: req.body?.public_id,
    })

    return res.json(result)
  } catch (error) {
    const status = error?.status || error?.statusCode || 500
    if (status >= 500) console.error('❌ deleteProductImage error:', error)

    return res.status(status).json({
      error: error?.code || 'Internal server error',
    })
  }
}

module.exports = {
  deleteProductImage,
}
