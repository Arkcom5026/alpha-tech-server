const {
  getReadyToSell,
  getReadyToSellStructuredDetails,
} = require('../services/readyToSellService')

const getReadyToSellProducts = async (req, res) => {
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

    console.error('❌ getReadyToSell error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const getStructuredReadyToSellDetails = async (req, res) => {
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

    console.error('❌ getReadyToSellStructuredDetails error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = {
  getReadyToSellProducts,
  getStructuredReadyToSellDetails,
}
