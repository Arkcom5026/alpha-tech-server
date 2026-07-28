'use strict'

const { LegacyQuickReceiptRepository } = require('./quickReceiptRepository')
const { LegacyQuickReceiptService } = require('./quickReceiptService')

const asNumber = (value, fallback = 0) => {
  if (value === '' || value === null || value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const asPositiveInteger = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const requestContextError = (code, statusCode = 401) => {
  const error = new Error(code)
  error.code = code
  error.statusCode = statusCode
  return error
}

const requireRequestContext = (req) => {
  const branchId = asPositiveInteger(req.user?.branchId)
  const userId = asPositiveInteger(req.user?.id)

  if (!branchId) throw requestContextError('BRANCH_ID_MISSING')
  if (!userId) throw requestContextError('USER_ID_MISSING')

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
    const result = await buildService(req).ensureDraft({
      source,
      supplierId: asNumber(supplierId, 0),
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
    const { id } = req.params
    if (!id) return res.status(400).json({ code: 'INVALID', message: 'missing receipt id' })

    const { itemId, productId, qty, unitCost = 0, vatRate = 0 } = req.body || {}
    const result = await buildService(req).saveDraftItem({
      receiptId: id,
      itemId: itemId || undefined,
      productId: asNumber(productId),
      qty: asNumber(qty),
      unitCost: asNumber(unitCost),
      vatRate: asNumber(vatRate),
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
    const { id, itemId } = req.params
    if (!id || !itemId) {
      return res.status(400).json({ code: 'INVALID', message: 'missing id or itemId' })
    }

    const result = await buildService(req).deleteDraftItem({ receiptId: id, itemId, branchId })
    return res.status(200).json(result)
  } catch (error) {
    return next(error)
  }
}

const finalize = async (req, res, next) => {
  try {
    const { branchId } = requireRequestContext(req)
    const { id } = req.params
    if (!id) return res.status(400).json({ code: 'INVALID', message: 'missing receipt id' })

    const result = await buildService(req).finalize({
      receiptId: id,
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
