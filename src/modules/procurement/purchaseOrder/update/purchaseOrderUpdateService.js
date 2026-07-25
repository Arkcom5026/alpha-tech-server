const {
  findPurchaseOrderForUpdate,
  updatePurchaseOrderTransaction,
} = require('./purchaseOrderUpdateRepository')

const updatePurchaseOrder = async ({ purchaseOrderId, branchId, note, status, items }) => {
  const normalizedPurchaseOrderId = Number(purchaseOrderId)
  const normalizedBranchId = Number(branchId)

  if (!normalizedPurchaseOrderId) {
    const error = new Error('Invalid ID')
    error.code = 'INVALID_PURCHASE_ORDER_ID'
    throw error
  }

  if (!normalizedBranchId) {
    const error = new Error('Unauthorized: Missing branchId')
    error.code = 'MISSING_BRANCH_ID'
    throw error
  }

  const existing = await findPurchaseOrderForUpdate({
    purchaseOrderId: normalizedPurchaseOrderId,
    branchId: normalizedBranchId,
  })

  if (!existing) {
    const error = new Error('ไม่พบใบสั่งซื้อในสาขานี้')
    error.code = 'PURCHASE_ORDER_NOT_FOUND'
    throw error
  }

  await updatePurchaseOrderTransaction({
    purchaseOrderId: normalizedPurchaseOrderId,
    branchId: normalizedBranchId,
    note,
    status,
    items,
  })

  return { success: true }
}

module.exports = {
  updatePurchaseOrder,
}
