// src/modules/product/query/readyToSell/controllers/productReadyToSellController.js

const {
  getReadyToSell,
  getReadyToSellStructuredDetails,
} = require('../../../services/operationalProductRuntimeService')

const listReadyToSell = async (req, res) => {
  try {
    const result = await getReadyToSell({
      branchId: req.user?.branchId,
      q: req.query?.q,
      search: req.query?.search,
      searchText: req.query?.searchText,
      mode: req.query?.mode,
      page: req.query?.page,
      pageSize: req.query?.pageSize,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })
    console.error('❌ listReadyToSell error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const getReadyToSellDetail = async (req, res) => {
  try {
    const result = await getReadyToSellStructuredDetails({
      branchId: req.user?.branchId,
      productId: req.params.productId,
      q: req.query?.q || '',
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })
    if (error?.code === 'INVALID_PRODUCT_ID') return res.status(400).json({ error: 'invalid productId' })
    console.error('❌ getReadyToSellDetail error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = {
  listReadyToSell,
  getReadyToSellDetail,
}
