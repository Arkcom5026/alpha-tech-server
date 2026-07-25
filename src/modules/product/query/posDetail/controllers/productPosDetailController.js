// src/modules/product/query/posDetail/controllers/productPosDetailController.js

const { findOperationalProductById } = require('../../../services/operationalProductRuntimeService')

const getProductForPOS = async (req, res) => {
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
    console.error('❌ getProductForPOS error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { getProductForPOS }
