const {
  findPurchaseOrderDetail,
} = require('./purchaseOrderDetailRepository')

const toNumber = (value) =>
  value && typeof value.toNumber === 'function'
    ? value.toNumber()
    : Number(value ?? 0)

const getPurchaseOrderDetail = async ({ branchId, purchaseOrderId }) => {
  const normalizedBranchId = Number(branchId)
  if (!normalizedBranchId) {
    const error = new Error('MISSING_BRANCH_ID')
    error.code = 'MISSING_BRANCH_ID'
    throw error
  }

  const normalizedPurchaseOrderId = Number.parseInt(purchaseOrderId, 10)
  if (!normalizedPurchaseOrderId) {
    const error = new Error('INVALID_ID')
    error.code = 'INVALID_ID'
    throw error
  }

  const purchaseOrder = await findPurchaseOrderDetail({
    branchId: normalizedBranchId,
    purchaseOrderId: normalizedPurchaseOrderId,
  })

  if (!purchaseOrder) {
    const error = new Error('PURCHASE_ORDER_NOT_FOUND')
    error.code = 'PURCHASE_ORDER_NOT_FOUND'
    throw error
  }

  return {
    ...purchaseOrder,
    items: (purchaseOrder.items || []).map((item) => {
      const product = item.product || {}
      const receiptItems = item.receipts || []

      return {
        ...item,
        receiptItems,
        receivedQuantity: receiptItems.reduce(
          (sum, receipt) => sum + toNumber(receipt.quantity),
          0
        ),
        categoryName:
          product.productType?.globalProductType?.category?.name ?? null,
        productTypeName: product.productType?.name ?? null,
        brandName: product.brand?.name ?? null,
        productProfileName: null,
        productTemplateName: product.templateProduct?.name ?? null,
        unitName:
          product.unit?.name ?? product.templateProduct?.unit?.name ?? null,
        productModel: null,
        productName: product.name ?? null,
      }
    }),
  }
}

module.exports = {
  getPurchaseOrderDetail,
}
