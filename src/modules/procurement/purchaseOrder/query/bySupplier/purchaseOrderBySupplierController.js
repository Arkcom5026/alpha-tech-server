const {
  getPurchaseOrdersBySupplier,
} = require('./purchaseOrderBySupplierService')

const getPurchaseOrdersBySupplierHandler = async (req, res) => {
  try {
    const purchaseOrders = await getPurchaseOrdersBySupplier({
      branchId: req.user?.branchId,
      supplierId: req.params?.supplierId ?? req.query?.supplierId,
    })

    return res.json(purchaseOrders)
  } catch (error) {
    if (error?.code === 'MISSING_BRANCH_ID') {
      return res.status(401).json({ error: 'Unauthorized: Missing branchId' })
    }

    if (error?.code === 'INVALID_SUPPLIER_ID') {
      return res.status(400).json({ error: 'Invalid supplierId' })
    }

    console.error('❌ getPurchaseOrdersBySupplier error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

module.exports = {
  getPurchaseOrdersBySupplierHandler,
}
