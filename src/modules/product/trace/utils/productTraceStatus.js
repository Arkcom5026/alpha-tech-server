const resolveCurrentCustody = (stockItem) => {
  const status = String(stockItem?.status || '').toUpperCase()

  if (status === 'SOLD') return 'CUSTOMER'
  if (status === 'CLAIMED') return 'CLAIM_PROCESS'
  if (status === 'RETURNED') return 'BRANCH_RETURN'
  if (status === 'LOST') return 'UNKNOWN'
  if (status === 'DAMAGED') return 'BRANCH_DAMAGED'
  return 'BRANCH'
}

const resolveLifecycleStage = (stockItem) => {
  if (stockItem?.repairJobs?.length) return 'AFTER_SALES_SERVICE'
  if (stockItem?.warrantyClaims?.length) return 'CLAIM'

  const saleItems = Array.isArray(stockItem?.saleItems) ? stockItem.saleItems : []
  const latestSaleItem = saleItems.length ? saleItems[saleItems.length - 1] : null

  if (latestSaleItem?.returnItems?.length) return 'RETURNED'
  if (latestSaleItem?.sale) return 'SOLD'
  if (stockItem?.purchaseOrderReceiptItem) return 'RECEIVED'
  return 'REGISTERED'
}

module.exports = {
  resolveCurrentCustody,
  resolveLifecycleStage,
}
