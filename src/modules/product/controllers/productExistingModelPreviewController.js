const {
  getProductExistingModelPreview,
} = require('../services/productExistingModelPreviewService')

const getExistingModelPreview = async (req, res) => {
  try {
    const result = await getProductExistingModelPreview({
      branchId: req.user?.branchId || req.employee?.branchId,
      productTypeId: req.query?.productTypeId,
      brandId: req.query?.brandId,
      take: req.query?.take,
    })

    res.set('Cache-Control', 'no-store')
    return res.json(result)
  } catch (error) {
    console.error('❌ getExistingModelPreview error:', error)

    const status = error?.status || error?.statusCode || 500
    return res.status(status).json({
      error: error?.code || 'FAILED_TO_LOAD_PRODUCT_EXISTING_MODEL_PREVIEW',
    })
  }
}

module.exports = {
  getExistingModelPreview,
}
