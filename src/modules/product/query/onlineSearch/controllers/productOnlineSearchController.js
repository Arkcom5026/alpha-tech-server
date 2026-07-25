// src/modules/product/query/onlineSearch/controllers/productOnlineSearchController.js

const { findOperationalProductsForOnline } = require('../../../services/operationalProductRuntimeService')

const searchProductsForOnline = async (req, res) => {
  try {
    const result = await findOperationalProductsForOnline({
      branchId: Number(req.user?.branchId) || Number.parseInt(req.query.branchId, 10),
      search: req.query.search || req.query.searchText || '',
      take: req.query.take,
      size: req.query.size,
      page: req.query.page,
      productTypeId: req.query.productTypeId,
      brandId: req.query.brandId,
      readyOnly: req.query.readyOnly,
      hasPrice: req.query.hasPrice,
      mode: req.query.mode,
      simpleOnly: req.query.simpleOnly,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'BRANCH_REQUIRED') return res.status(400).json({ error: 'BRANCH_REQUIRED' })
    console.error('❌ searchProductsForOnline error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { searchProductsForOnline }
