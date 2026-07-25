const {
  findEligiblePurchaseOrders,
} = require('./purchaseOrderEligibleForReceiptRepository')

const ELIGIBLE_PURCHASE_ORDER_STATUSES = [
  'PENDING',
  'PARTIALLY_RECEIVED',
]

const listEligiblePurchaseOrdersForReceipt = async ({ branchId }) => {
  const normalizedBranchId = Number(branchId)

  if (!normalizedBranchId) {
    const error = new Error('Missing branchId')
    error.code = 'MISSING_BRANCH_ID'
    throw error
  }

  return findEligiblePurchaseOrders({
    branchId: normalizedBranchId,
    statuses: ELIGIBLE_PURCHASE_ORDER_STATUSES,
  })
}

module.exports = {
  ELIGIBLE_PURCHASE_ORDER_STATUSES,
  listEligiblePurchaseOrdersForReceipt,
}
