const {
  deletePurchaseOrder,
} = require('./purchaseOrderDeleteService')

const deletePurchaseOrderHandler = async (req, res) => {
  try {
    const result = await deletePurchaseOrder({
      purchaseOrderId: req.params?.id,
      branchId: req.user?.branchId,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'MISSING_DELETE_CONTEXT') {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' })
    }

    if (error?.code === 'PURCHASE_ORDER_NOT_FOUND') {
      return res.status(404).json({ error: 'ไม่พบใบสั่งซื้อนี้ในสาขาของคุณ' })
    }

    console.error('❌ deletePurchaseOrder error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

module.exports = {
  deletePurchaseOrderHandler,
}
