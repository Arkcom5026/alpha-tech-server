const { listPurchaseOrders } = require('./purchaseOrderListService')

const getPurchaseOrderList = async (req, res) => {
  try {
    const purchaseOrders = await listPurchaseOrders({
      branchId: req.user?.branchId,
      page: req.query?.page,
      pageSize: req.query?.pageSize,
      search: req.query?.search,
      status: req.query?.status,
    })

    return res.json(purchaseOrders)
  } catch (error) {
    if (error?.code === 'MISSING_BRANCH_ID') {
      return res.status(401).json({ error: 'Unauthorized: Missing branchId' })
    }

    console.error('❌ getPurchaseOrderList error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

module.exports = {
  getPurchaseOrderList,
}
