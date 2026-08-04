'use strict'

const repository = require('./onlineProductVisibilityRepository')

const REASONS = Object.freeze({
  PRODUCT_INACTIVE: 'PRODUCT_INACTIVE',
  PRICE_INACTIVE: 'PRICE_INACTIVE',
  MISSING_ONLINE_PRICE: 'MISSING_ONLINE_PRICE',
  PRICE_NOT_STARTED: 'PRICE_NOT_STARTED',
  PRICE_EXPIRED: 'PRICE_EXPIRED',
  BRAND_INACTIVE: 'BRAND_INACTIVE',
  TAXONOMY_INACTIVE: 'TAXONOMY_INACTIVE',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
})

const toNumber = (value) => (value == null ? null : Number(value))
const toIso = (value) => (value ? new Date(value).toISOString() : null)

const classify = (row, now) => {
  const reasons = []
  const priceOnline = toNumber(row.priceOnline)
  const availableQuantity = Number(row.availableQuantity || 0)

  if (!row.productActive) reasons.push(REASONS.PRODUCT_INACTIVE)
  if (!row.priceActive) reasons.push(REASONS.PRICE_INACTIVE)
  if (!(priceOnline > 0)) reasons.push(REASONS.MISSING_ONLINE_PRICE)
  if (row.effectiveDate && new Date(row.effectiveDate) > now) reasons.push(REASONS.PRICE_NOT_STARTED)
  if (row.expiredDate && new Date(row.expiredDate) <= now) reasons.push(REASONS.PRICE_EXPIRED)
  if (row.brandId && !row.brandActive) reasons.push(REASONS.BRAND_INACTIVE)

  const taxonomyInactive = Boolean(
    row.productTypeId && (
      !row.productTypeActive ||
      !row.globalTypeId ||
      !row.globalTypeActive ||
      !row.categoryId ||
      !row.categoryActive
    )
  )
  if (taxonomyInactive) reasons.push(REASONS.TAXONOMY_INACTIVE)
  if (availableQuantity <= 0) reasons.push(REASONS.OUT_OF_STOCK)

  const blockingReasons = reasons.filter((reason) => reason !== REASONS.OUT_OF_STOCK)
  const visibleOnline = blockingReasons.length === 0

  return {
    productId: Number(row.productId),
    branchPriceId: Number(row.branchPriceId),
    name: row.productName,
    barcode: row.saleBarcode || null,
    brand: row.brandId ? { id: Number(row.brandId), name: row.brandName } : null,
    productType: row.productTypeId ? { id: Number(row.productTypeId), name: row.productTypeName } : null,
    category: row.categoryId ? { id: Number(row.categoryId), name: row.categoryName } : null,
    priceOnline,
    priceActive: Boolean(row.priceActive),
    effectiveDate: toIso(row.effectiveDate),
    expiredDate: toIso(row.expiredDate),
    availableQuantity,
    visibleOnline,
    sellableNow: visibleOnline && availableQuantity > 0,
    status: visibleOnline
      ? (availableQuantity > 0 ? 'SELLABLE_NOW' : 'VISIBLE_OUT_OF_STOCK')
      : 'BLOCKED',
    reasons,
  }
}

const summarize = (items) => {
  const summary = {
    totalCandidates: items.length,
    visibleOnline: 0,
    sellableNow: 0,
    visibleOutOfStock: 0,
    blocked: 0,
    reasonCounts: Object.fromEntries(Object.values(REASONS).map((reason) => [reason, 0])),
  }

  for (const item of items) {
    if (item.visibleOnline) summary.visibleOnline += 1
    if (item.sellableNow) summary.sellableNow += 1
    if (item.status === 'VISIBLE_OUT_OF_STOCK') summary.visibleOutOfStock += 1
    if (item.status === 'BLOCKED') summary.blocked += 1
    for (const reason of item.reasons) summary.reasonCounts[reason] += 1
  }

  return summary
}

const auditForBranch = async (branchId, options = {}) => {
  const now = options.now instanceof Date ? options.now : new Date()
  const rows = await repository.auditBranchProducts(branchId, options.db)
  const items = rows.map((row) => classify(row, now))
  return {
    branchId,
    generatedAt: now.toISOString(),
    summary: summarize(items),
    items,
  }
}

module.exports = Object.freeze({ REASONS, classify, summarize, auditForBranch })
