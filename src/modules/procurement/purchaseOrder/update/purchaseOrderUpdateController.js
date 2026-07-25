const { updatePurchaseOrder } = require('./purchaseOrderUpdateService')

const updatePurchaseOrderHandler = async (req, res) => {
  try {
    const result = await updatePurchaseOrder({
      purchaseOrderId: req.params?.id,
      branchId: req.user?.branchId,
      note: req.body?.note,
      status: req.body?.status,
      items: req.body?.items,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'INVALID_PURCHASE_ORDER_ID') {
      return res.status(400).json({ error: 'Invalid ID' })
    }

    if (error?.code === 'MISSING_BRANCH_ID') {
      return res.status(401).json({ error: 'Unauthorized: Missing branchId' })
    }

    if (error?.code === 'PURCHASE_ORDER_NOT_FOUND') {
      return res.status(404).json({ error: 'ไม่พบใบสั่งซื้อในสาขานี้' })
    }

    console.error('❌ updatePurchaseOrder error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

module.exports = {
  updatePurchaseOrderHandler,
}
