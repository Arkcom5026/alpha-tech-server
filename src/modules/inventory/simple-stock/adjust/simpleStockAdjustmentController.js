const service = require('./simpleStockAdjustmentService')
const { parseSimpleStockAdjustmentInput } = require('./simpleStockAdjustmentInput')
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority')

const createSimpleAdjustment = async (req, res, next) => {
  try {
    const canAdjust = hasCapability(
      req.user,
      POSITION_CAPABILITIES.INVENTORY_ADJUST
    )

    if (!canAdjust) {
      const error = new Error('SIMPLE_STOCK_ADJUSTMENT_FORBIDDEN')
      error.code = 'SIMPLE_STOCK_ADJUSTMENT_FORBIDDEN'
      error.statusCode = 403
      throw error
    }

    const payload = parseSimpleStockAdjustmentInput(req.body)
    const result = await service.adjust({
      branchId: req.user?.branchId,
      employeeId: req.user?.employeeId,
      payload,
    })

    return res.status(201).json({
      ok: true,
      data: result,
      requestId: req.id || null,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = { createSimpleAdjustment }
