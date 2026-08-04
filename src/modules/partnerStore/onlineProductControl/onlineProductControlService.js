'use strict'

const repository = require('./onlineProductControlRepository')

const fail = (code, statusCode, message) => {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  throw error
}

const parseDate = (value, field) => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) fail('INVALID_MARKETPLACE_PRICE_DATE', 400, `${field} ไม่ถูกต้อง`)
  return date
}

const updateMarketplacePrice = async ({ branchId, productId, input, db }) => {
  if (!Number.isInteger(branchId) || branchId <= 0) fail('BRANCH_CONTEXT_REQUIRED', 403, 'ไม่พบร้านของผู้ทำรายการ')
  if (!Number.isInteger(productId) || productId <= 0) fail('INVALID_PRODUCT_ID', 400, 'productId ไม่ถูกต้อง')

  const current = await repository.findOwnedPrice({ branchId, productId, db })
  if (!current) fail('BRANCH_PRICE_NOT_FOUND', 404, 'ไม่พบราคาของสินค้านี้ในร้านปัจจุบัน')

  const data = {}
  if (input.priceOnline !== undefined) {
    const priceOnline = Number(input.priceOnline)
    if (!Number.isFinite(priceOnline) || priceOnline < 0) fail('INVALID_ONLINE_PRICE', 400, 'ราคาออนไลน์ต้องเป็นศูนย์หรือมากกว่า')
    data.priceOnline = priceOnline
  }
  if (typeof input.isActive === 'boolean') data.isActive = input.isActive
  const effectiveDate = parseDate(input.effectiveDate, 'วันเริ่มใช้ราคา')
  const expiredDate = parseDate(input.expiredDate, 'วันสิ้นสุดราคา')
  if (effectiveDate !== undefined) data.effectiveDate = effectiveDate
  if (expiredDate !== undefined) data.expiredDate = expiredDate

  const nextEffective = effectiveDate === undefined ? current.effectiveDate : effectiveDate
  const nextExpired = expiredDate === undefined ? current.expiredDate : expiredDate
  if (nextEffective && nextExpired && nextExpired < nextEffective) {
    fail('INVALID_ONLINE_PRICE_WINDOW', 400, 'วันสิ้นสุดราคาต้องไม่เร็วกว่าวันเริ่มใช้')
  }
  if (Object.keys(data).length === 0) fail('EMPTY_MARKETPLACE_PRICE_UPDATE', 400, 'ไม่มีข้อมูลที่ต้องอัปเดต')

  return repository.updateOwnedPrice({ branchId, productId, data, db })
}

module.exports = Object.freeze({ updateMarketplacePrice })
