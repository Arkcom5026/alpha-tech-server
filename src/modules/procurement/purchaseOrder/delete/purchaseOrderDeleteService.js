const {
  findPurchaseOrderForDelete,
  deletePurchaseOrderById,
} = require('./purchaseOrderDeleteRepository')

const deletePurchaseOrder = async ({ purchaseOrderId, branchId }) => {
  const normalizedPurchaseOrderId = Number(purchaseOrderId)
  const normalizedBranchId = Number(branchId)

  if (!normalizedPurchaseOrderId || !normalizedBranchId) {
    const error = new Error('Missing purchase order delete context')
    error.code = 'MISSING_DELETE_CONTEXT'
    throw error
  }

  const purchaseOrder = await findPurchaseOrderForDelete({
    purchaseOrderId: normalizedPurchaseOrderId,
    branchId: normalizedBranchId,
  })

  if (!purchaseOrder) {
    const error = new Error('Purchase order not found in branch')
    error.code = 'PURCHASE_ORDER_NOT_FOUND'
    throw error
  }

  await deletePurchaseOrderById({
    purchaseOrderId: normalizedPurchaseOrderId,
  })

  return { success: true }
}

module.exports = {
  deletePurchaseOrder,
}
