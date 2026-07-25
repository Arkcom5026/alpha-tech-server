const { changePurchaseOrderStatus } = require('./purchaseOrderStatusService')

const updatePurchaseOrderStatusHandler = async (req, res) => {
  try {
    const updated = await changePurchaseOrderStatus({
      purchaseOrderId: req.params?.id,
      branchId: req.user?.branchId,
      status: req.body?.status,
    })

    return res.json(updated)
  } catch (error) {
    if (error?.code === 'INVALID_PURCHASE_ORDER_ID') {
      return res.status(400).json({ error: 'Invalid ID' })
    }

    if (error?.code === 'INVALID_STATUS') {
      return res.status(400).json({ error: 'INVALID_STATUS' })
    }

    if (error?.code === 'MISSING_BRANCH_ID') {
      return res.status(401).json({ error: 'Unauthorized: Missing branchId' })
    }

    if (error?.code === 'PURCHASE_ORDER_NOT_FOUND') {
      return res.status(404).json({ error: 'Purchase Order not found' })
    }

    console.error('❌ updatePurchaseOrderStatus error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

module.exports = {
  updatePurchaseOrderStatusHandler,
}
