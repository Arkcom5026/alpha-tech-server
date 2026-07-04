const {
  getProductExistingModelPreview,
} = require('../services/productExistingModelPreviewService')

const getExistingModelPreview = async (req, res) => {
  try {
    const result = await getProductExistingModelPreview({
      productTypeId: req.query?.productTypeId,
      brandId: req.query?.brandId,
      take: req.query?.take,
    })

    res.set('Cache-Control', 'no-store')
    return res.json(result)
  } catch (error) {
    console.error('❌ getExistingModelPreview error:', error)
    return res.status(500).json({ error: 'FAILED_TO_LOAD_PRODUCT_EXISTING_MODEL_PREVIEW' })
  }
}

module.exports = {
  getExistingModelPreview,
}
