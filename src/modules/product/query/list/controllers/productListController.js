// src/modules/product/query/list/controllers/productListController.js

const productListService = require('../services/productListService')

const listProducts = async (req, res) => {
  try {
    const result = await productListService.listProducts({
      branchId: req.user?.branchId,
      query: req.query || {},
    })

    return res.json(result)
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        error: error.code || error.message,
        ...(error.message && error.message !== error.code ? { message: error.message } : {}),
      })
    }

    console.error('❌ productList runtime error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { listProducts }
