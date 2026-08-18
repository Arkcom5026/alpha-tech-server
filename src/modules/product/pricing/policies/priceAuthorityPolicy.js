'use strict'

const PRICE_FIELDS = Object.freeze([
  'costPrice',
  'priceRetail',
  'priceWholesale',
  'priceTechnician',
  'priceOnline',
])

const ROLE_MATRIX = Object.freeze({
  ADMIN: new Set(PRICE_FIELDS),
  SUPERADMIN: new Set(PRICE_FIELDS),
  OWNER: new Set(PRICE_FIELDS),
  MANAGER: new Set(['priceRetail', 'priceWholesale', 'priceTechnician', 'priceOnline']),
})

const makeError = (code, status = 400, message = code, detail) => {
  const error = new Error(message)
  error.code = code
  error.status = status
  error.statusCode = status
  if (detail !== undefined) error.detail = detail
  return error
}

const assertActor = (actor = {}) => {
  const branchId = Number(actor.branchId)
  const employeeId = Number(actor.employeeId)
  const role = String(actor.role || actor.v2Role || '').toUpperCase()

  if (!Number.isInteger(branchId) || branchId <= 0) {
    throw makeError('PRICE_BRANCH_CONTEXT_REQUIRED', 403, 'ไม่พบสาขาของผู้ทำรายการ')
  }
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw makeError('PRICE_EMPLOYEE_CONTEXT_REQUIRED', 403, 'ไม่พบพนักงานผู้ทำรายการ')
  }
  if (!role) throw makeError('PRICE_ROLE_CONTEXT_REQUIRED', 403, 'ไม่พบบทบาทผู้ทำรายการ')

  return { branchId, employeeId, role }
}

const touchedPriceFields = (payload = {}) => PRICE_FIELDS.filter((field) => payload[field] !== undefined)

const assertMutationAuthority = ({ actor, payload }) => {
  const authority = assertActor(actor)
  const touched = touchedPriceFields(payload)
  if (touched.length === 0) return authority

  const allowed = ROLE_MATRIX[authority.role]
  const forbidden = touched.filter((field) => !allowed?.has(field))
  if (forbidden.length > 0) {
    throw makeError(
      'PRICE_MUTATION_FORBIDDEN',
      403,
      'บทบาทนี้ไม่มีสิทธิ์เปลี่ยนราคาที่ร้องขอ',
      { role: authority.role, forbiddenFields: forbidden },
    )
  }

  return authority
}

const assertPriceValue = (field, value) => {
  if (value === undefined || value === null) return
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    throw makeError('INVALID_PRICE_VALUE', 400, `ราคา ${field} ไม่ถูกต้อง`, { field, value })
  }
  if (numeric < 0) {
    throw makeError('NEGATIVE_PRICE_NOT_ALLOWED', 400, `ราคา ${field} ต้องไม่ติดลบ`, { field, value })
  }
  if (numeric === 0) {
    throw makeError('ZERO_PRICE_REQUIRES_EXPLICIT_POLICY', 400, `ราคา ${field} ห้ามเป็น 0 โดยไม่มีนโยบายเฉพาะ`, { field })
  }
}

const assertPricePayload = ({ actor, payload = {}, effectiveDate, expiredDate }) => {
  const authority = assertMutationAuthority({ actor, payload })
  for (const field of touchedPriceFields(payload)) assertPriceValue(field, payload[field])

  const effective = effectiveDate ? new Date(effectiveDate) : null
  const expired = expiredDate ? new Date(expiredDate) : null
  if (effective && Number.isNaN(effective.getTime())) throw makeError('INVALID_PRICE_EFFECTIVE_DATE', 400)
  if (expired && Number.isNaN(expired.getTime())) throw makeError('INVALID_PRICE_EXPIRED_DATE', 400)
  if (effective && expired && expired < effective) {
    throw makeError('INVALID_PRICE_DATE_RANGE', 400, 'expiredDate ต้องไม่เร็วกว่าหรือก่อน effectiveDate')
  }

  return authority
}

module.exports = Object.freeze({
  PRICE_FIELDS,
  ROLE_MATRIX,
  assertActor,
  assertMutationAuthority,
  assertPriceValue,
  assertPricePayload,
  touchedPriceFields,
})
