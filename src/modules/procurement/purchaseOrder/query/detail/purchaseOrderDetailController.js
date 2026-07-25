const {
  getPurchaseOrderDetail,
} = require('./purchaseOrderDetailService')

const getPurchaseOrderById = async (req, res) => {
  try {
    const purchaseOrder = await getPurchaseOrderDetail({
      branchId: req.user?.branchId,
      purchaseOrderId: req.params?.id,
    })

    return res.json(purchaseOrder)
  } catch (error) {
    if (error?.code === 'INVALID_ID') {
      return res.status(400).json({ error: 'Invalid ID' })
    }

    if (error?.code === 'MISSING_BRANCH_ID') {
      return res.status(401).json({ error: 'Unauthorized: Missing branchId' })
    }

    if (error?.code === 'PURCHASE_ORDER_NOT_FOUND') {
      return res.status(404).json({ error: 'Purchase Order not found' })
    }

    console.error('❌ getPurchaseOrderById error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

module.exports = {
  getPurchaseOrderById,
}
