const {
  searchProductsForPos,
  getProductForPosById,
} = require('../services/productPosQueryService')

const searchProducts = async (req, res) => {
  try {
    const result = await searchProductsForPos({
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
    console.error('❌ searchProductsForPos error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const getProductById = async (req, res) => {
  try {
    const result = await getProductForPosById({
      branchId: req.user?.branchId,
      productId: req.params.id,
    })
    return res.json(result)
  } catch (error) {
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })
    if (error?.code === 'INVALID_ID') return res.status(400).json({ error: 'INVALID_ID' })
    if (error?.code === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })
    console.error('❌ getProductForPosById error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { searchProducts, getProductById }
