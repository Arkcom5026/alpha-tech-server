'use strict'

const {
  buildSimpleStockContext,
  requireSimpleStockBranch,
  sendSimpleStockError,
  toNumber,
} = require('../shared/simpleStockHttp')

const createSimpleSale = async (req, res) => {
  try {
    const branchId = requireSimpleStockBranch(req, res)
    if (!branchId) return undefined

    const { productId, qty, unitPrice } = req.body || {}
    const normalizedQty = toNumber(qty)
    const normalizedUnitPrice = unitPrice === undefined ? undefined : toNumber(unitPrice)

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
    if (
      normalizedUnitPrice !== undefined &&
      (!Number.isFinite(normalizedUnitPrice) || normalizedUnitPrice < 0)
    ) {
      return sendSimpleStockError(res, 400, 'unitPrice must be a non-negative number', {
        context: buildSimpleStockContext(req),
      })
    }

    return sendSimpleStockError(res, 501, 'createSimpleSale is not implemented yet', {
      context: buildSimpleStockContext(req),
      hint: 'Endpoint is mounted successfully. Implement simpleStockService.sale when ready.',
    })
  } catch (error) {
    console.error('❌ createSimpleSale error:', error)
    return sendSimpleStockError(res, 500, 'Internal Server Error')
  }
}

module.exports = { createSimpleSale }
