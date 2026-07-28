'use strict'

const service = require('./stockMovementQueryService')

const listStockMovements = async (req, res, next) => {
  try {
    const result = await service.list({
      branchId: req.user?.branchId,
      query: req.query,
    })

    return res.json({
      ok: true,
      data: result,
      requestId: req.id || null,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = { listStockMovements }
