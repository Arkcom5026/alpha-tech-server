const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : undefined
}

const toNum = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(typeof value === 'string' ? value.trim().replace(/,/g, '') : value)
  return Number.isFinite(n) ? n : undefined
}

const normStr = (value) => (value == null ? '' : String(value)).trim()

const pickBranchPricePayload = (data = {}) => {
  const d = data && typeof data === 'object' ? data : {}
  const bp = d.branchPrice && typeof d.branchPrice === 'object' ? d.branchPrice : {}

  const hasNested = [
    'costPrice',
    'priceRetail',
    'priceWholesale',
    'priceTechnician',
    'priceOnline',
    'isActive',
  ].some((key) => bp[key] !== undefined)

  if (hasNested) return bp

  const flat = {
    costPrice: d.costPrice,
    priceRetail: d.priceRetail,
    priceWholesale: d.priceWholesale,
    priceTechnician: d.priceTechnician,
    priceOnline: d.priceOnline,
    isActive: d.branchPriceActive ?? d.isActive,
  }

  const hasFlat = [
    'costPrice',
    'priceRetail',
    'priceWholesale',
    'priceTechnician',
    'priceOnline',
    'isActive',
  ].some((key) => flat[key] !== undefined)

  return hasFlat ? flat : null
}

module.exports = {
  normStr,
  pickBranchPricePayload,
  toInt,
  toNum,
}
