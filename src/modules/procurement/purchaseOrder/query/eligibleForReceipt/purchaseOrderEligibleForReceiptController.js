const {
  listEligiblePurchaseOrdersForReceipt,
} = require('./purchaseOrderEligibleForReceiptService')

const getEligiblePurchaseOrdersForReceipt = async (req, res) => {
  try {
    const purchaseOrders = await listEligiblePurchaseOrdersForReceipt({
      branchId: req.user?.branchId,
    })

    return res.json(purchaseOrders)
  } catch (error) {
    if (error?.code === 'MISSING_BRANCH_ID') {
      return res.status(401).json({ error: 'unauthorized' })
    }

    console.error('❌ getEligiblePurchaseOrdersForReceipt error:', error)
    return res.status(500).json({
      error: 'ไม่สามารถโหลดใบสั่งซื้อสำหรับสร้างใบรับสินค้าได้',
    })
  }
}

module.exports = {
  getEligiblePurchaseOrdersForReceipt,
}
