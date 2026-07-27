const { searchProductsForOnline, getProductForOnlineById } = require('../services/productOnlineQueryService')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const searchProducts = async (req, res) => {
  try {
    const result = await searchProductsForOnline({
      branchId: Number(req.user?.branchId) || toInt(req.query.branchId),
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

const getProductById = async (req, res) => {
  try {
    const result = await getProductForOnlineById({
      branchId: toInt(req.query.branchId) ?? Number(req.user?.branchId),
      productId: req.params.id,
    })
    return res.json(result)
  } catch (error) {
    if (error?.code === 'BRANCH_REQUIRED') return res.status(400).json({ error: 'BRANCH_REQUIRED' })
    if (error?.code === 'INVALID_ID') return res.status(400).json({ error: 'INVALID_ID' })
    if (error?.code === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })
    console.error('❌ getProductForOnlineById error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = { searchProducts, getProductById }
