// src/modules/product/migrateToSimple/controllers/productMigrateToSimpleController.js

const productMigrateToSimpleService = require('../services/productMigrateToSimpleService')

const migrateToSimple = async (req, res) => {
  try {
    const result = await productMigrateToSimpleService.migrateToSimple({
      productId: req.params.id,
      branchId: req.user?.branchId,
    })

    return res.json(result)
  } catch (error) {
    const status = error?.status || error?.statusCode || 500
    if (status >= 500) console.error('❌ productMigrateToSimple runtime error:', error)

    return res.status(status).json({
      error: error?.code || error?.message || 'Internal server error',
    })
  }
}

module.exports = { migrateToSimple }
