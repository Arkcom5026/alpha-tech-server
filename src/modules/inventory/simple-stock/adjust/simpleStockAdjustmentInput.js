const adjustmentInputError = (code, message, field) => {
  const error = new Error(message || code)
  error.code = code
  error.statusCode = 400
  error.details = field ? { field } : null
  return error
}

const optionalInteger = (value, field) => {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw adjustmentInputError('INVALID_SIMPLE_ADJUSTMENT_INPUT', `${field} must be a positive integer`, field)
  }
  return parsed
}

const optionalNonNegativeNumber = (value, field) => {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw adjustmentInputError('INVALID_SIMPLE_ADJUSTMENT_INPUT', `${field} must be a non-negative number`, field)
  }
  return parsed
}

const parseSimpleStockAdjustmentInput = (body = {}) => {
  const productId = optionalInteger(body.productId, 'productId')
  if (!productId) {
    throw adjustmentInputError('INVALID_SIMPLE_ADJUSTMENT_INPUT', 'productId is required', 'productId')
  }

  const qtyDelta = Number(body.qtyDelta)
  if (!Number.isFinite(qtyDelta) || qtyDelta === 0) {
    throw adjustmentInputError('INVALID_SIMPLE_ADJUSTMENT_INPUT', 'qtyDelta must be a non-zero number', 'qtyDelta')
  }

  const note = String(body.note || '').trim()
  if (!note) {
    throw adjustmentInputError('SIMPLE_ADJUSTMENT_REASON_REQUIRED', 'Adjustment reason is required', 'note')
  }

  return {
    productId,
    qtyDelta,
    unitCost: optionalNonNegativeNumber(body.unitCost, 'unitCost'),
    refType: String(body.refType || 'MANUAL_ADJUSTMENT').trim() || 'MANUAL_ADJUSTMENT',
    refId: optionalInteger(body.refId, 'refId'),
    note,
  }
}

module.exports = { parseSimpleStockAdjustmentInput }
