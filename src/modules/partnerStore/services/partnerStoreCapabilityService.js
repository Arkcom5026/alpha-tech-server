'use strict'

const repository = require('../repositories/partnerStoreCapabilityRepository')

const DELIVERY_FEE_MODES = new Set(['FREE', 'FIXED', 'NEGOTIATED'])
const SERVICE_AREA_MODES = new Set(['PICKUP_ONLY', 'ADMIN_AREAS', 'DISTANCE', 'NATIONWIDE'])
const SERVICE_AREA_TYPES = new Set(['PROVINCE', 'DISTRICT', 'SUBDISTRICT', 'POSTAL_CODE'])

const fail = (statusCode, code, message, details) => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  error.details = details
  throw error
}

const normalizeNullableText = (value) => {
  if (value === undefined) return undefined
  if (value === null) return null
  const text = String(value).trim()
  return text || null
}

const normalizeOptionalNumber = (value, field) => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number)) fail(400, 'PARTNER_STORE_VALIDATION_FAILED', `${field} ต้องเป็นตัวเลข`)
  return number
}

const normalizeBoolean = (value, field) => {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') fail(400, 'PARTNER_STORE_VALIDATION_FAILED', `${field} ต้องเป็น boolean`)
  return value
}

const normalizeServiceAreas = (areas) => {
  if (areas === undefined) return undefined
  if (!Array.isArray(areas)) fail(400, 'PARTNER_STORE_VALIDATION_FAILED', 'serviceAreas ต้องเป็น array')

  const seen = new Set()
  return areas.map((area, index) => {
    const areaType = String(area?.areaType || '').trim().toUpperCase()
    const areaCode = String(area?.areaCode || '').trim()
    const areaName = normalizeNullableText(area?.areaName)
    const active = area?.active === undefined ? true : normalizeBoolean(area.active, `serviceAreas[${index}].active`)

    if (!SERVICE_AREA_TYPES.has(areaType)) {
      fail(400, 'PARTNER_STORE_VALIDATION_FAILED', `serviceAreas[${index}].areaType ไม่ถูกต้อง`)
    }
    if (!areaCode) fail(400, 'PARTNER_STORE_VALIDATION_FAILED', `serviceAreas[${index}].areaCode จำเป็นต้องมี`)

    const identity = `${areaType}:${areaCode.toLowerCase()}`
    if (seen.has(identity)) fail(409, 'PARTNER_STORE_SERVICE_AREA_DUPLICATED', 'พื้นที่ให้บริการซ้ำกัน')
    seen.add(identity)

    return { areaType, areaCode, areaName, active }
  })
}

const normalizeCapability = (payload = {}) => {
  const deliveryFeeMode = normalizeNullableText(payload.deliveryFeeMode)?.toUpperCase()
  const serviceAreaMode = normalizeNullableText(payload.serviceAreaMode)?.toUpperCase()

  if (deliveryFeeMode && !DELIVERY_FEE_MODES.has(deliveryFeeMode)) {
    fail(400, 'PARTNER_STORE_VALIDATION_FAILED', 'deliveryFeeMode ไม่ถูกต้อง')
  }
  if (serviceAreaMode && !SERVICE_AREA_MODES.has(serviceAreaMode)) {
    fail(400, 'PARTNER_STORE_VALIDATION_FAILED', 'serviceAreaMode ไม่ถูกต้อง')
  }

  return {
    storefrontEnabled: normalizeBoolean(payload.storefrontEnabled, 'storefrontEnabled'),
    storefrontSlug: normalizeNullableText(payload.storefrontSlug)?.toLowerCase(),
    displayName: normalizeNullableText(payload.displayName),
    contactPhone: normalizeNullableText(payload.contactPhone),
    pickupEnabled: normalizeBoolean(payload.pickupEnabled, 'pickupEnabled'),
    deliveryEnabled: normalizeBoolean(payload.deliveryEnabled, 'deliveryEnabled'),
    deliveryFeeMode,
    fixedDeliveryFee: normalizeOptionalNumber(payload.fixedDeliveryFee, 'fixedDeliveryFee'),
    serviceAreaMode,
    maxDeliveryDistanceKm: normalizeOptionalNumber(payload.maxDeliveryDistanceKm, 'maxDeliveryDistanceKm'),
    preparationSlaMinutes: normalizeOptionalNumber(payload.preparationSlaMinutes, 'preparationSlaMinutes'),
    pickupInstruction: normalizeNullableText(payload.pickupInstruction),
    deliveryInstruction: normalizeNullableText(payload.deliveryInstruction),
    serviceAreas: normalizeServiceAreas(payload.serviceAreas),
  }
}

const compactUndefined = (value) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))

const validatePolicy = (next) => {
  if (next.storefrontEnabled && !next.storefrontSlug) {
    fail(400, 'PARTNER_STORE_SLUG_REQUIRED', 'ร้านที่เปิดเผยต่อสาธารณะต้องมี storefrontSlug')
  }

  if (!next.deliveryEnabled) {
    if (next.deliveryFeeMode !== null || next.fixedDeliveryFee !== null || next.serviceAreaMode !== 'PICKUP_ONLY' || next.maxDeliveryDistanceKm !== null) {
      fail(400, 'PARTNER_STORE_DELIVERY_POLICY_INVALID', 'ร้านที่ปิดการจัดส่งต้องใช้ PICKUP_ONLY และไม่มีค่าจัดส่งหรือระยะทาง')
    }
  } else {
    if (!next.deliveryFeeMode || next.serviceAreaMode === 'PICKUP_ONLY') {
      fail(400, 'PARTNER_STORE_DELIVERY_POLICY_INVALID', 'ร้านที่เปิดจัดส่งต้องกำหนดค่าจัดส่งและพื้นที่ให้บริการ')
    }
  }

  if (next.deliveryFeeMode === 'FIXED' && !(next.fixedDeliveryFee > 0)) {
    fail(400, 'PARTNER_STORE_FIXED_FEE_REQUIRED', 'โหมด FIXED ต้องมี fixedDeliveryFee มากกว่า 0')
  }
  if (next.deliveryFeeMode !== 'FIXED' && next.fixedDeliveryFee !== null) {
    fail(400, 'PARTNER_STORE_FIXED_FEE_INVALID', 'fixedDeliveryFee ใช้ได้เฉพาะโหมด FIXED')
  }
  if (next.serviceAreaMode === 'DISTANCE' && !(next.maxDeliveryDistanceKm > 0)) {
    fail(400, 'PARTNER_STORE_DISTANCE_REQUIRED', 'โหมด DISTANCE ต้องมี maxDeliveryDistanceKm มากกว่า 0')
  }
  if (next.serviceAreaMode !== 'DISTANCE' && next.maxDeliveryDistanceKm !== null) {
    fail(400, 'PARTNER_STORE_DISTANCE_INVALID', 'maxDeliveryDistanceKm ใช้ได้เฉพาะโหมด DISTANCE')
  }
  if (next.serviceAreaMode === 'ADMIN_AREAS' && next.serviceAreas.length === 0) {
    fail(400, 'PARTNER_STORE_SERVICE_AREA_REQUIRED', 'โหมด ADMIN_AREAS ต้องมีพื้นที่ให้บริการอย่างน้อยหนึ่งรายการ')
  }
  if (next.serviceAreaMode !== 'ADMIN_AREAS' && next.serviceAreas.length > 0) {
    fail(400, 'PARTNER_STORE_SERVICE_AREA_INVALID', 'serviceAreas ใช้ได้เฉพาะโหมด ADMIN_AREAS')
  }
}

const defaultCapability = (branchId) => ({
  branchId,
  storefrontEnabled: false,
  storefrontSlug: null,
  displayName: null,
  contactPhone: null,
  pickupEnabled: true,
  deliveryEnabled: false,
  deliveryFeeMode: null,
  fixedDeliveryFee: null,
  serviceAreaMode: 'PICKUP_ONLY',
  maxDeliveryDistanceKm: null,
  preparationSlaMinutes: null,
  pickupInstruction: null,
  deliveryInstruction: null,
  serviceAreas: [],
})

const getForBranch = async (branchId) => {
  const capability = await repository.findByBranchId(branchId)
  return capability || defaultCapability(branchId)
}

const saveForBranch = async (branchId, payload) => {
  const normalized = normalizeCapability(payload)
  const existing = await repository.findByBranchId(branchId)
  const current = existing || defaultCapability(branchId)
  const next = {
    ...current,
    ...compactUndefined(normalized),
    serviceAreas: normalized.serviceAreas === undefined ? current.serviceAreas || [] : normalized.serviceAreas,
  }

  validatePolicy(next)

  return repository.withTransaction(async (tx) => {
    const { serviceAreas, id: _id, branchId: _branchId, createdAt: _createdAt, updatedAt: _updatedAt, ...capabilityData } = next
    const saved = await repository.upsertForBranch(
      { branchId, create: capabilityData, update: capabilityData },
      tx
    )

    if (normalized.serviceAreas !== undefined) {
      await repository.replaceServiceAreas({ capabilityId: saved.id, serviceAreas }, tx)
    }

    return repository.findByBranchId(branchId, tx)
  })
}

module.exports = { getForBranch, saveForBranch }
