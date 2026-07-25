// src/modules/product/query/detail/controllers/productDetailController.js

const {
  findOperationalProductById,
} = require('../../../services/operationalProductRuntimeService')

const getProductDetail = async (req, res) => {
  try {
    const result = await findOperationalProductById({
      branchId: req.user?.branchId,
      productId: req.params.id,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })
    if (error?.code === 'INVALID_ID') return res.status(400).json({ error: 'INVALID_ID' })
    if (error?.code === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })

    console.error('❌ productDetail runtime error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { getProductDetail }
