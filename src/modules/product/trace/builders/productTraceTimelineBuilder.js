const {
  ProductTraceEventType,
  ProductTraceEventCategory,
  createProductTraceTimelineEvent,
} = require('../contracts/productTraceTimelineContract')
const { toIsoString, compareOccurredAt } = require('../utils/productTraceDate')
const { roundMoney } = require('../utils/productTraceMoney')

const buildProductTraceTimeline = ({ stockItem, procurement, sales, returns, claims, repairs, permissions }) => {
  const events = []
  if (stockItem.receivedAt) events.push(createProductTraceTimelineEvent({
    id: `received-${stockItem.id}`, type: ProductTraceEventType.PRODUCT_RECEIVED,
    category: ProductTraceEventCategory.PROCUREMENT, occurredAt: toIsoString(stockItem.receivedAt),
    title: 'รับสินค้าเข้าสต็อก',
    document: procurement?.receipt ? { type: 'PURCHASE_ORDER_RECEIPT', id: procurement.receipt.id, code: procurement.receipt.code } : null,
    actor: procurement?.receipt?.receivedBy || null,
    amount: permissions.canViewFinancials ? procurement?.costPrice ?? null : null,
    status: procurement?.receipt?.statusReceipt || stockItem.status,
    metadata: { supplierName: permissions.canViewSupplier ? procurement?.supplier?.name || null : null, purchaseOrderCode: procurement?.purchaseOrder?.code || null },
  }))
  if (stockItem.scannedAt) events.push(createProductTraceTimelineEvent({
    id: `scanned-${stockItem.id}`, type: ProductTraceEventType.PRODUCT_SCANNED,
    category: ProductTraceEventCategory.INVENTORY, occurredAt: toIsoString(stockItem.scannedAt),
    title: 'บันทึกสินค้าเข้าระบบ',
    actor: stockItem.scannedBy ? { id: stockItem.scannedBy.id, name: stockItem.scannedBy.name || '-' } : null,
    status: stockItem.status, metadata: { locationCode: stockItem.locationCode || null },
  }))
  for (const cycle of sales?.cycles || (sales ? [sales] : [])) {
    events.push(createProductTraceTimelineEvent({
      id: `sold-${cycle.sale.id}-${stockItem.id}`, type: ProductTraceEventType.PRODUCT_SOLD,
      category: ProductTraceEventCategory.SALES, occurredAt: cycle.sale.soldAt, title: 'ขายสินค้า',
      document: { type: 'SALE', id: cycle.sale.id, code: cycle.sale.code }, actor: cycle.sale.employee,
      amount: permissions.canViewFinancials ? cycle.pricing?.netPrice ?? null : null,
      status: cycle.sale.status,
      metadata: { customerName: cycle.sale.customer?.companyName || cycle.sale.customer?.name || null, paymentStatus: cycle.sale.statusPayment },
    }))
  }
  for (const item of returns || []) {
    const saleReturn = item.saleReturn
    if (!saleReturn) continue
    events.push(createProductTraceTimelineEvent({
      id: `returned-${saleReturn.id}-${item.returnItemId}`, type: ProductTraceEventType.PRODUCT_RETURNED,
      category: ProductTraceEventCategory.RETURN, occurredAt: saleReturn.returnedAt,
      title: 'รับคืนสินค้าและคืนเข้าพร้อมขาย', description: item.reason || saleReturn.reason || null,
      document: { type: 'SALE_RETURN', id: saleReturn.id, code: saleReturn.code },
      actor: saleReturn.employee, amount: permissions.canViewFinancials ? item.refundAmount : null,
      status: saleReturn.status, metadata: { returnType: saleReturn.returnType, resultingStockStatus: 'IN_STOCK' },
    }))
    for (const refund of item.refundTransactions || []) events.push(createProductTraceTimelineEvent({
      id: `refund-${refund.id}`, type: ProductTraceEventType.PRODUCT_REFUNDED,
      category: ProductTraceEventCategory.RETURN, occurredAt: refund.refundedAt,
      title: 'คืนเงินให้ลูกค้า', document: { type: 'SALE_RETURN', id: saleReturn.id, code: saleReturn.code },
      actor: refund.refundedBy, amount: permissions.canViewFinancials ? refund.amount : null,
      status: saleReturn.status, metadata: { method: refund.method, deducted: refund.deducted },
    }))
  }
  for (const claim of claims || []) events.push(createProductTraceTimelineEvent({
    id: `claim-${claim.id}`, type: ProductTraceEventType.PRODUCT_CLAIM_CREATED,
    category: ProductTraceEventCategory.CLAIM, occurredAt: claim.createdAt, title: 'เปิดเคลมสินค้า',
    description: claim.reason, document: { type: 'WARRANTY_CLAIM', id: claim.id, code: claim.claimNo }, status: claim.status,
  }))
  for (const repair of repairs || []) {
    events.push(createProductTraceTimelineEvent({
      id: `repair-created-${repair.id}`, type: ProductTraceEventType.PRODUCT_REPAIR_RECEIVED,
      category: ProductTraceEventCategory.REPAIR, occurredAt: repair.createdAt, title: 'รับสินค้าเข้าซ่อม',
      description: repair.reportedSymptoms, document: { type: 'REPAIR_JOB', id: repair.id, code: repair.jobNo },
      actor: repair.technician, amount: permissions.canViewFinancials ? repair.estimatedCost : null, status: repair.status,
    }))
  }
  return events.map((event) => ({ ...event, amount: roundMoney(event.amount) })).sort(compareOccurredAt)
}

module.exports = { buildProductTraceTimeline }
