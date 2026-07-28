'use strict'

const repository = require('./stockMovementQueryRepository')

const movementQueryError = (code, statusCode = 400) => {
  const error = new Error(code)
  error.code = code
  error.statusCode = statusCode
  return error
}

const asPositiveInteger = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const asOptionalDate = (value, code) => {
  if (value == null || value === '') return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw movementQueryError(code)
  return parsed
}

class StockMovementQueryService {
  constructor(repo = repository) {
    this.repository = repo
  }

  async list({ branchId, query = {} }) {
    const normalizedBranchId = asPositiveInteger(branchId)
    if (!normalizedBranchId) throw movementQueryError('BRANCH_ID_MISSING', 401)

    const productId = query.productId == null || query.productId === ''
      ? null
      : asPositiveInteger(query.productId)
    if (query.productId != null && query.productId !== '' && !productId) {
      throw movementQueryError('INVALID_PRODUCT_ID')
    }

    const refId = query.refId == null || query.refId === ''
      ? null
      : asPositiveInteger(query.refId)
    if (query.refId != null && query.refId !== '' && !refId) {
      throw movementQueryError('INVALID_REF_ID')
    }

    const from = asOptionalDate(query.from, 'INVALID_FROM_DATE')
    const to = asOptionalDate(query.to, 'INVALID_TO_DATE')
    if (from && to && from > to) throw movementQueryError('INVALID_DATE_RANGE')

    const requestedLimit = Number(query.limit)
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 200)
      : 50

    const rows = await this.repository.list({
      branchId: normalizedBranchId,
      productId,
      type: query.type ? String(query.type).trim().toUpperCase() : null,
      refType: query.refType ? String(query.refType).trim() : null,
      refId,
      from,
      to,
      limit,
    })

    return {
      branchId: normalizedBranchId,
      count: rows.length,
      limit,
      movements: rows.map((row) => ({
        ...row,
        qty: row.qty?.toString?.() ?? String(row.qty ?? 0),
      })),
    }
  }
}

module.exports = new StockMovementQueryService()
module.exports.StockMovementQueryService = StockMovementQueryService
