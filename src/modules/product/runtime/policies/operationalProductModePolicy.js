const PRODUCT_INVENTORY_BEHAVIOR = Object.freeze({
  TRACKED: 'TRACKED',
  NON_STOCK: 'NON_STOCK',
})

const policyError = (code) => {
  const error = new Error(code)
  error.code = code
  error.statusCode = 400
  return error
}

const toBoolean = (value) =>
  value === true || value === 'true' || value === 1 || value === '1'

const normalizeInventoryBehavior = (value) => {
  if (value === undefined || value === null || value === '') {
    return PRODUCT_INVENTORY_BEHAVIOR.TRACKED
  }

  const normalized = String(value).trim().toUpperCase()
  if (!Object.values(PRODUCT_INVENTORY_BEHAVIOR).includes(normalized)) {
    throw policyError('INVALID_PRODUCT_INVENTORY_BEHAVIOR')
  }

  return normalized
}

const decideOperationalProductMode = ({
  explicitMode,
  mode,
  noSN,
  trackSerialNumber,
  inventoryBehavior,
} = {}) => {
  const rawMode = explicitMode ?? mode
  const normalizedMode =
    rawMode === undefined || rawMode === null ? '' : String(rawMode).trim().toUpperCase()
  const hasNoSN = noSN !== undefined
  const hasTrack = trackSerialNumber !== undefined
  const normalizedNoSN = toBoolean(noSN)
  const normalizedTrack = toBoolean(trackSerialNumber)
  const normalizedBehavior = normalizeInventoryBehavior(inventoryBehavior)

  let result

  if (['SIMPLE', 'NOSN', 'NO_SN', 'NO-SN'].includes(normalizedMode)) {
    result = { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
  } else if (['STRUCTURED', 'SN'].includes(normalizedMode)) {
    result = { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
  } else if (hasNoSN || hasTrack) {
    if (normalizedTrack || (hasNoSN && normalizedNoSN === false)) {
      result = { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
    } else {
      result = { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
    }
  } else {
    result = { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
  }

  if (
    result.mode === 'STRUCTURED' &&
    normalizedBehavior === PRODUCT_INVENTORY_BEHAVIOR.NON_STOCK
  ) {
    throw policyError('NON_STOCK_REQUIRES_SIMPLE_MODE')
  }

  return {
    ...result,
    inventoryBehavior: normalizedBehavior,
  }
}

module.exports = {
  PRODUCT_INVENTORY_BEHAVIOR,
  decideOperationalProductMode,
  normalizeInventoryBehavior,
}
