const {
  findPurchaseOrderForStatus,
  updatePurchaseOrderStatus,
} = require('./purchaseOrderStatusRepository')

const changePurchaseOrderStatus = async ({ purchaseOrderId, branchId, status }) => {
  const normalizedPurchaseOrderId = Number(purchaseOrderId)
  const normalizedBranchId = Number(branchId)
  const normalizedStatus = String(status || '').trim().toUpperCase()

  if (!normalizedPurchaseOrderId) {
    const error = new Error('Invalid ID')
    error.code = 'INVALID_PURCHASE_ORDER_ID'
    throw error
  }

  if (!normalizedStatus) {
    const error = new Error('INVALID_STATUS')
    error.code = 'INVALID_STATUS'
    throw error
  }

  if (!normalizedBranchId) {
    const error = new Error('Unauthorized: Missing branchId')
    error.code = 'MISSING_BRANCH_ID'
    throw error
  }

  const purchaseOrder = await findPurchaseOrderForStatus({
    purchaseOrderId: normalizedPurchaseOrderId,
    branchId: normalizedBranchId,
  })

  if (!purchaseOrder) {
    const error = new Error('Purchase Order not found')
    error.code = 'PURCHASE_ORDER_NOT_FOUND'
    throw error
  }

  return updatePurchaseOrderStatus({
    purchaseOrderId: normalizedPurchaseOrderId,
    status: normalizedStatus,
  })
}

module.exports = {
  changePurchaseOrderStatus,
}
