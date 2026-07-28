'use strict'

const {
  buildSimpleStockContext,
  requireSimpleStockBranch,
  sendSimpleStockError,
  toNumber,
} = require('../shared/simpleStockHttp')

const createSimpleReceipt = async (req, res) => {
  try {
    const branchId = requireSimpleStockBranch(req, res)
    if (!branchId) return undefined

    const { productId, qty, unitCost, refType, refId, note } = req.body || {}
    const normalizedQty = toNumber(qty)
    const normalizedUnitCost = toNumber(unitCost)

    if (!productId) {
      return sendSimpleStockError(res, 400, 'productId is required', {
        context: buildSimpleStockContext(req),
      })
    }
    if (!Number.isFinite(normalizedQty) || normalizedQty <= 0) {
      return sendSimpleStockError(res, 400, 'qty must be a positive number', {
        context: buildSimpleStockContext(req),
      })
    }
    if (!Number.isFinite(normalizedUnitCost) || normalizedUnitCost < 0) {
      return sendSimpleStockError(res, 400, 'unitCost must be a non-negative number', {
        context: buildSimpleStockContext(req),
      })
    }

    return sendSimpleStockError(res, 501, 'createSimpleReceipt is not implemented yet', {
      context: buildSimpleStockContext(req),
      hint: 'Endpoint is mounted successfully. Implement the receipt application slice when ready.',
      compatibility: {
        branchId,
        payload: {
          productId,
          qty: normalizedQty,
          unitCost: normalizedUnitCost,
          refType,
          refId,
          note,
        },
      },
    })
  } catch (error) {
    console.error('❌ createSimpleReceipt error:', error)
    return sendSimpleStockError(res, 500, 'Internal Server Error')
  }
}

module.exports = { createSimpleReceipt }
