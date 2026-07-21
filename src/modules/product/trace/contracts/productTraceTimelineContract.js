const ProductTraceEventType = Object.freeze({
  PRODUCT_RECEIVED: 'PRODUCT_RECEIVED',
  PRODUCT_SCANNED: 'PRODUCT_SCANNED',
  PRODUCT_SOLD: 'PRODUCT_SOLD',
  PRODUCT_RETURNED: 'PRODUCT_RETURNED',
  PRODUCT_REFUNDED: 'PRODUCT_REFUNDED',
  PRODUCT_CLAIM_CREATED: 'PRODUCT_CLAIM_CREATED',
  PRODUCT_REPAIR_RECEIVED: 'PRODUCT_REPAIR_RECEIVED',
  PRODUCT_REPAIR_UPDATED: 'PRODUCT_REPAIR_UPDATED',
})

const ProductTraceEventCategory = Object.freeze({
  PROCUREMENT: 'PROCUREMENT',
  INVENTORY: 'INVENTORY',
  SALES: 'SALES',
  RETURN: 'RETURN',
  CLAIM: 'CLAIM',
  REPAIR: 'REPAIR',
})

const createProductTraceTimelineEvent = ({
  id,
  type,
  category,
  occurredAt,
  title,
  description = null,
  document = null,
  actor = null,
  amount = null,
  status = null,
  metadata = {},
}) => ({
  id: String(id),
  type,
  category,
  occurredAt: occurredAt || null,
  title,
  description,
  document,
  actor,
  amount,
  status,
  metadata,
})

module.exports = {
  ProductTraceEventType,
  ProductTraceEventCategory,
  createProductTraceTimelineEvent,
}
