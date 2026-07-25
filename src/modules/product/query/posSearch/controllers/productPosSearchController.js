// src/modules/product/query/posSearch/controllers/productPosSearchController.js

const { findOperationalProductsForPOS } = require('../../../services/operationalProductRuntimeService')

const searchProductsForPOS = async (req, res) => {
  try {
    const result = await findOperationalProductsForPOS({
      branchId: req.user?.branchId,
      search: req.query.search || req.query.searchText || '',
      take: req.query.take,
      page: req.query.page,
      productTypeId: req.query.productTypeId,
      brandId: req.query.brandId,
      readyOnly: req.query.readyOnly,
      hasPrice: req.query.hasPrice,
      activeOnly: req.query.activeOnly,
      includeInactive: req.query.includeInactive,
      mode: req.query.mode,
      simpleOnly: req.query.simpleOnly,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })
    console.error('❌ searchProductsForPOS error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { searchProductsForPOS }
