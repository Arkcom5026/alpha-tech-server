'use strict'

const {
  buildSimpleStockContext,
  requireSimpleStockBranch,
  sendSimpleStockError,
} = require('../shared/simpleStockHttp')

const pingSimpleStock = async (req, res) => {
  try {
    const branchId = requireSimpleStockBranch(req, res)
    if (!branchId) return undefined

    return res.json({
      ok: true,
      service: 'simple-stock',
      message: 'SIMPLE routes are mounted and authenticated',
      context: buildSimpleStockContext(req),
    })
  } catch (error) {
    console.error('❌ pingSimpleStock error:', error)
    return sendSimpleStockError(res, 500, 'Internal Server Error')
  }
}

module.exports = { pingSimpleStock }
