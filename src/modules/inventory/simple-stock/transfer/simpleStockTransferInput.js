const transferInputError = (code, message, field) => {
  const error = new Error(message || code)
  error.code = code
  error.statusCode = 400
  error.details = field ? { field } : null
  return error
}

const positiveInteger = (value, field, required = true) => {
  if (!required && (value === undefined || value === null || value === '')) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw transferInputError('INVALID_SIMPLE_TRANSFER_INPUT', `${field} must be a positive integer`, field)
  }
  return parsed
}

const parseSimpleStockTransferInput = (body = {}, idempotencyKey) => {
  const key = String(idempotencyKey || '').trim()
  if (key.length < 8 || key.length > 100) {
    throw transferInputError(
      'SIMPLE_TRANSFER_IDEMPOTENCY_KEY_REQUIRED',
      'X-Idempotency-Key must contain 8 to 100 characters',
      'X-Idempotency-Key'
    )
  }

  const quantity = Number(body.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw transferInputError('INVALID_SIMPLE_TRANSFER_INPUT', 'quantity must be a positive number', 'quantity')
  }

  const note = String(body.note || '').trim()
  if (!note) {
    throw transferInputError('SIMPLE_TRANSFER_REASON_REQUIRED', 'Transfer reason is required', 'note')
  }

  return {
    sourceProductId: positiveInteger(body.sourceProductId || body.productId, 'sourceProductId'),
    targetBranchId: positiveInteger(body.targetBranchId, 'targetBranchId'),
    targetProductId: positiveInteger(body.targetProductId, 'targetProductId', false),
    quantity,
    refId: positiveInteger(body.refId, 'refId', false),
    note,
    transferKey: key,
    movementRefType: `SIMPLE_TRANSFER:${key}`,
  }
}

module.exports = { parseSimpleStockTransferInput }
