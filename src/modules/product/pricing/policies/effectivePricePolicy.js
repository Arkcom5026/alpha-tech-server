'use strict'

const PRICE_TYPE_FIELD = Object.freeze({
  retail: 'priceRetail',
  wholesale: 'priceWholesale',
  technician: 'priceTechnician',
  online: 'priceOnline',
})

const makeError = (code, status = 409, message = code, detail) => {
  const error = new Error(message)
  error.code = code
  error.status = status
  error.statusCode = status
  if (detail !== undefined) error.detail = detail
  return error
}

const normalizePriceType = (priceType) => String(priceType || 'retail').toLowerCase()

const resolveEffectivePrice = ({ row, priceType, context = {} }) => {
  const normalizedType = normalizePriceType(priceType)
  const field = PRICE_TYPE_FIELD[normalizedType]
  if (!field) {
    throw makeError('UNSUPPORTED_PRICE_TYPE', 400, 'ประเภทราคาไม่รองรับ', {
      priceType: normalizedType,
      supported: Object.keys(PRICE_TYPE_FIELD),
      ...context,
    })
  }

  if (!row) {
    throw makeError('ACTIVE_BRANCH_PRICE_NOT_FOUND', 409, 'ไม่พบราคาที่ใช้งานของสินค้านี้ในร้านปัจจุบัน', {
      priceType: normalizedType,
      field,
      ...context,
    })
  }

  const rawValue = row[field]
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    throw makeError('PRICE_VALUE_MISSING', 409, 'ราคาที่เลือกยังไม่ได้กำหนด', {
      priceType: normalizedType,
      field,
      ...context,
    })
  }

  const numeric = Number(rawValue)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw makeError('PRICE_VALUE_NOT_EFFECTIVE', 409, 'ราคาที่เลือกไม่สามารถใช้งานได้', {
      priceType: normalizedType,
      field,
      value: rawValue,
      ...context,
    })
  }

  return { price: numeric, priceType: normalizedType, field }
}

module.exports = Object.freeze({
  PRICE_TYPE_FIELD,
  normalizePriceType,
  resolveEffectivePrice,
})
