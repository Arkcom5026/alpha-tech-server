'use strict'

const { LegacyQuickReceiptRepository } = require('./quickReceiptRepository')
const { LegacyQuickReceiptService } = require('./quickReceiptService')

const asPositiveInteger = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const asPositiveNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const asNonNegativeNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

const requestError = (code, statusCode = 400) => {
  const error = new Error(code)
  error.code = code
  error.statusCode = statusCode
  return error
}

const requireRequestContext = (req) => {
  const branchId = asPositiveInteger(req.user?.branchId)
  const userId = asPositiveInteger(req.user?.id)

  if (!branchId) throw requestError('BRANCH_ID_MISSING', 401)
  if (!userId) throw requestError('USER_ID_MISSING', 401)

  return { branchId, userId }
}

const getDb = (req) => {
  if (req?.app?.locals?.knex) return req.app.locals.knex
  try { return require('../../../../../db') } catch {}
  try { return require('../../../../../../db') } catch {}
  return null
}

const buildService = (req) => new LegacyQuickReceiptService(
  new LegacyQuickReceiptRepository(getDb(req))
)

const ensureDraft = async (req, res, next) => {
  try {
    const { branchId, userId } = requireRequestContext(req)
    const { source = 'QUICK_HYBRID', supplierId = 0, note = '' } = req.body || {}
    const normalizedSupplierId = supplierId === 0 || supplierId === '0'
      ? 0
      : asPositiveInteger(supplierId)

    if (normalizedSupplierId == null) throw requestError('INVALID_SUPPLIER_ID')

    const result = await buildService(req).ensureDraft({
      source: String(source || 'QUICK_HYBRID').trim() || 'QUICK_HYBRID',
      supplierId: normalizedSupplierId,
      note: String(note || ''),
      userId,
      branchId,
    })

    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
}

const saveItemDraft = async (req, res, next) => {
  try {
    const { branchId } = requireRequestContext(req)
    const receiptId = asPositiveInteger(req.params?.id)
    if (!receiptId) throw requestError('INVALID_RECEIPT_ID')

    const { itemId, productId, qty, unitCost = 0, vatRate = 0 } = req.body || {}
    const normalizedItemId = itemId == null || itemId === '' ? null : asPositiveInteger(itemId)
    const normalizedProductId = asPositiveInteger(productId)
    const normalizedQty = asPositiveNumber(qty)
    const normalizedUnitCost = asNonNegativeNumber(unitCost)
    const normalizedVatRate = asNonNegativeNumber(vatRate)

    if (itemId != null && itemId !== '' && !normalizedItemId) throw requestError('INVALID_RECEIPT_ITEM_ID')
    if (!normalizedProductId) throw requestError('INVALID_PRODUCT_ID')
    if (!normalizedQty) throw requestError('INVALID_QUANTITY')
    if (normalizedUnitCost == null) throw requestError('INVALID_UNIT_COST')
    if (normalizedVatRate == null || normalizedVatRate > 100) throw requestError('INVALID_VAT_RATE')

    const result = await buildService(req).saveDraftItem({
      receiptId,
      itemId: normalizedItemId || undefined,
      productId: normalizedProductId,
      qty: normalizedQty,
      unitCost: normalizedUnitCost,
      vatRate: normalizedVatRate,
      idempotencyKey: req.get('X-Idempotency-Key') || undefined,
      branchId,
    })

    return res.status(200).json(result)
  } catch (error) {
    return next(error)
  }
}

const deleteItemDraft = async (req, res, next) => {
  try {
    const { branchId } = requireRequestContext(req)
    const receiptId = asPositiveInteger(req.params?.id)
    const itemId = asPositiveInteger(req.params?.itemId)

    if (!receiptId) throw requestError('INVALID_RECEIPT_ID')
    if (!itemId) throw requestError('INVALID_RECEIPT_ITEM_ID')

    const result = await buildService(req).deleteDraftItem({ receiptId, itemId, branchId })
    return res.status(200).json(result)
  } catch (error) {
    return next(error)
  }
}

const finalize = async (req, res, next) => {
  try {
    const { branchId } = requireRequestContext(req)
    const receiptId = asPositiveInteger(req.params?.id)
    if (!receiptId) throw requestError('INVALID_RECEIPT_ID')

    const result = await buildService(req).finalize({
      receiptId,
      finalizeToken: req.get('X-Finalize-Token') || undefined,
      branchId,
    })

    return res.status(200).json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  ensureDraft,
  saveItemDraft,
  deleteItemDraft,
  finalize,
}
