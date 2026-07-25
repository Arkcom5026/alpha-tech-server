// src/modules/product/create/controllers/productLegacyCreateController.js

const {
  createLocalOperationalProduct,
} = require('../../services/operationalProductRuntimeService')

const createProduct = async (req, res) => {
  try {
    const result = await createLocalOperationalProduct({
      branchId: req.user?.branchId,
      data: req.body || {},
    })

    return res.status(201).json({ id: result.product?.id || result.id })
  } catch (error) {
    if (error?.code === 'BRANCH_ID_MISSING' || error?.code === 'BRANCH_REQUIRED') {
      return res.status(401).json({ error: 'unauthorized' })
    }

    console.error('❌ productLegacyCreate runtime error:', error)
    return res.status(500).json({ error: 'Failed to create product' })
  }
}

module.exports = { createProduct }
