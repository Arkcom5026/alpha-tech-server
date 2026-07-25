const {
  findPurchaseOrdersBySupplier,
} = require('./purchaseOrderBySupplierRepository')

const getPurchaseOrdersBySupplier = async ({ branchId, supplierId }) => {
  const normalizedBranchId = Number(branchId)
  if (!normalizedBranchId) {
    const error = new Error('Unauthorized: Missing branchId')
    error.code = 'MISSING_BRANCH_ID'
    throw error
  }

  const normalizedSupplierId = Number(supplierId)
  if (!normalizedSupplierId) {
    const error = new Error('Invalid supplierId')
    error.code = 'INVALID_SUPPLIER_ID'
    throw error
  }

  return findPurchaseOrdersBySupplier({
    branchId: normalizedBranchId,
    supplierId: normalizedSupplierId,
  })
}

module.exports = {
  getPurchaseOrdersBySupplier,
}
