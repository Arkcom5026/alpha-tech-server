const { toIsoString } = require('../utils/productTraceDate')
const { roundMoney } = require('../utils/productTraceMoney')

const buildProductTraceProcurement = (stockItem, permissions) => {
  const receiptItem = stockItem.purchaseOrderReceiptItem || null
  const receipt = receiptItem?.receipt || null
  const purchaseOrder = receipt?.purchaseOrder || receiptItem?.purchaseOrderItem?.purchaseOrder || null
  const supplier = receipt?.supplier || purchaseOrder?.supplier || null
  const cost = roundMoney(stockItem.costPrice ?? receiptItem?.costPrice ?? receiptItem?.purchaseOrderItem?.costPrice)

  if (!receiptItem && !receipt && !purchaseOrder && !supplier) return null

  return {
    receiptItemId: receiptItem?.id || null,
    quantity: roundMoney(receiptItem?.quantity),
    costPrice: permissions.canViewFinancials ? cost : null,
    receipt: receipt
      ? {
          id: receipt.id,
          code: receipt.code,
          source: receipt.source,
          statusReceipt: receipt.statusReceipt,
          statusPayment: receipt.statusPayment,
          receivedAt: toIsoString(receipt.receivedAt),
          supplierTaxInvoiceNumber: permissions.canViewSupplier
            ? receipt.supplierTaxInvoiceNumber || null
            : null,
          supplierTaxInvoiceDate: permissions.canViewSupplier
            ? toIsoString(receipt.supplierTaxInvoiceDate)
            : null,
          receivedBy: receipt.receivedBy
            ? { id: receipt.receivedBy.id, name: receipt.receivedBy.name || '-' }
            : null,
        }
      : null,
    purchaseOrder: purchaseOrder
      ? {
          id: purchaseOrder.id,
          code: purchaseOrder.code,
          status: purchaseOrder.status,
          date: toIsoString(purchaseOrder.date),
          createdBy: purchaseOrder.employee
            ? { id: purchaseOrder.employee.id, name: purchaseOrder.employee.name || '-' }
            : null,
        }
      : null,
    supplier: permissions.canViewSupplier && supplier
      ? {
          id: supplier.id,
          name: supplier.name,
          contactPerson: supplier.contactPerson || null,
          phone: supplier.phone || null,
          email: supplier.email || null,
          taxId: supplier.taxId || null,
        }
      : null,
  }
}

module.exports = {
  buildProductTraceProcurement,
}
