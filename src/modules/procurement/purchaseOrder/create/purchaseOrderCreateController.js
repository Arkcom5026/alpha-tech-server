const {
  createPurchaseOrder,
} = require('./purchaseOrderCreateService')

const createPurchaseOrderHandler = async (req, res) => {
  try {
    const purchaseOrder = await createPurchaseOrder({
      branchId: req.user?.branchId,
      employeeId: req.user?.employeeId,
      supplierId: req.body?.supplierId,
      note: req.body?.note,
      items: req.body?.items,
    })

    return res.status(201).json(purchaseOrder)
  } catch (error) {
    if (error?.code === 'MISSING_RUNTIME_CONTEXT') {
      return res
        .status(401)
        .json({ error: 'Unauthorized: Missing branchId/employeeId' })
    }

    if (error?.code === 'EMPTY_ITEMS') {
      return res
        .status(400)
        .json({ error: 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ' })
    }

    if (error?.code === 'INVALID_ITEM') {
      return res
        .status(400)
        .json({ error: 'รายการสินค้าไม่ถูกต้อง (productId/quantity/costPrice)' })
    }

    if (error?.code === 'CODE_GENERATION_EXHAUSTED') {
      return res
        .status(500)
        .json({ error: 'ไม่สามารถสร้างรหัส PO ที่ไม่ซ้ำได้ กรุณาลองใหม่' })
    }

    console.error('❌ createPurchaseOrder error:', error)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}

module.exports = {
  createPurchaseOrderHandler,
}
