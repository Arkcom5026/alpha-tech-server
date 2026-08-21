const service = require('./simpleStockTransferService')
const { parseSimpleStockTransferInput } = require('./simpleStockTransferInput')
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority')

const createSimpleTransfer = async (req, res, next) => {
  try {
    const canTransfer = hasCapability(
      req.user,
      POSITION_CAPABILITIES.INVENTORY_TRANSFER
    )

    if (!canTransfer) {
      const error = new Error('SIMPLE_STOCK_TRANSFER_FORBIDDEN')
      error.code = 'SIMPLE_STOCK_TRANSFER_FORBIDDEN'
      error.statusCode = 403
      throw error
    }

    const payload = parseSimpleStockTransferInput(
      req.body,
      req.headers['x-idempotency-key']
    )
    const result = await service.transfer({
      sourceBranchId: req.user?.branchId,
      employeeId: req.user?.employeeId,
      payload,
    })

    return res.status(result.replayed ? 200 : 201).json({
      ok: true,
      data: result,
      requestId: req.id || null,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = { createSimpleTransfer }
