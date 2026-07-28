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

const asOptionalText = (value, code, maxLength = 120) => {
  if (value == null || value === '') return null
  const normalized = String(value).trim()
  if (!normalized || normalized.length > maxLength) throw movementQueryError(code)
  return normalized
}

const asOptionalEnum = (value, allowed, code) => {
  if (value == null || value === '') return null
  const normalized = String(value).trim().toUpperCase()
  if (!allowed.includes(normalized)) throw movementQueryError(code)
  return normalized
}

const STOCK_MOVEMENT_TYPES = [
  'RECEIVE',
  'SALE',
  'ADJUST',
  'TRANSFER',
  'RETURN',
  'RESERVE',
  'RELEASE',
]

const encodeCursor = (row) => {
  if (!row?.id || !row?.occurredAt) return null
  return Buffer.from(JSON.stringify({
    id: Number(row.id),
    occurredAt: new Date(row.occurredAt).toISOString(),
  }), 'utf8').toString('base64url')
}

const decodeCursor = (value) => {
  if (value == null || value === '') return null

  try {
    const decoded = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'))
    const id = asPositiveInteger(decoded?.id)
    const occurredAt = asOptionalDate(decoded?.occurredAt, 'INVALID_CURSOR')
    if (!id || !occurredAt) throw movementQueryError('INVALID_CURSOR')
    return { id, occurredAt }
  } catch (error) {
    if (error?.code === 'INVALID_CURSOR') throw error
    throw movementQueryError('INVALID_CURSOR')
  }
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

    const stockItemId = query.stockItemId == null || query.stockItemId === ''
      ? null
      : asPositiveInteger(query.stockItemId)
    if (query.stockItemId != null && query.stockItemId !== '' && !stockItemId) {
      throw movementQueryError('INVALID_STOCK_ITEM_ID')
    }

    const simpleLotId = query.simpleLotId == null || query.simpleLotId === ''
      ? null
      : asPositiveInteger(query.simpleLotId)
    if (query.simpleLotId != null && query.simpleLotId !== '' && !simpleLotId) {
      throw movementQueryError('INVALID_SIMPLE_LOT_ID')
    }

    const refId = query.refId == null || query.refId === ''
      ? null
      : asPositiveInteger(query.refId)
    if (query.refId != null && query.refId !== '' && !refId) {
      throw movementQueryError('INVALID_REF_ID')
    }

    const cursor = decodeCursor(query.cursor)
    const barcode = asOptionalText(query.barcode, 'INVALID_BARCODE')
    const serialNumber = asOptionalText(query.serialNumber, 'INVALID_SERIAL_NUMBER')
    const direction = asOptionalEnum(query.direction, ['IN', 'OUT'], 'INVALID_DIRECTION')
    const type = asOptionalEnum(query.type, STOCK_MOVEMENT_TYPES, 'INVALID_MOVEMENT_TYPE')
    const refType = asOptionalText(query.refType, 'INVALID_REF_TYPE', 80)

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
      stockItemId,
      simpleLotId,
      type,
      direction,
      refType,
      refId,
      barcode,
      serialNumber,
      from,
      to,
      cursor,
      limit,
    })

    const hasMore = rows.length > limit
    const pageRows = hasMore ? rows.slice(0, limit) : rows
    const movements = pageRows.map((row) => ({
      ...row,
      qty: row.qty?.toString?.() ?? String(row.qty ?? 0),
      direction: row.qty?.isPositive?.()
        ? 'IN'
        : row.qty?.isNegative?.()
          ? 'OUT'
          : 'NEUTRAL',
      stockItem: row.stockItem
        ? {
            ...row.stockItem,
            costPrice: row.stockItem.costPrice?.toString?.() ?? null,
          }
        : null,
    }))

    return {
      branchId: normalizedBranchId,
      count: movements.length,
      limit,
      hasMore,
      nextCursor: hasMore ? encodeCursor(pageRows[pageRows.length - 1]) : null,
      movements,
    }
  }
}

module.exports = new StockMovementQueryService()
module.exports.StockMovementQueryService = StockMovementQueryService
