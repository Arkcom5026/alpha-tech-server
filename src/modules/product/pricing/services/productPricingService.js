const { Prisma } = require('../../../../../lib/prisma')
const repo = require('../repositories/productPricingRepository')
const priceAuthorityPolicy = require('../policies/priceAuthorityPolicy')

const makeError = (code, status = 400, message = code) => {
  const error = new Error(message)
  error.code = code
  error.status = status
  error.statusCode = status
  return error
}

const toDecimal = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value)
}

const toDateOrNull = (value) => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw makeError('INVALID_PRICE_DATE', 400)
  return date
}

const normalizePricePayload = (source = {}, { requireCorePrices = false } = {}) => {
  const costPrice = source.costPrice
  const priceRetail = source.retailPrice ?? source.priceRetail

  if (requireCorePrices) {
    if (costPrice === undefined || costPrice === null || Number(costPrice) <= 0) {
      throw makeError('COST_PRICE_REQUIRED', 400, 'กรุณาระบุราคาทุน')
    }
    if (priceRetail === undefined || priceRetail === null || Number(priceRetail) <= 0) {
      throw makeError('PRICE_RETAIL_REQUIRED', 400, 'กรุณาระบุราคาขายปลีก')
    }
  }

  const effectiveDate = toDateOrNull(source.effectiveDate)
  const expiredDate = toDateOrNull(source.expiredDate)
  if (effectiveDate && expiredDate && expiredDate < effectiveDate) {
    throw makeError('INVALID_PRICE_DATE_RANGE', 400, 'expiredDate ต้องไม่เร็วกว่าหรือก่อน effectiveDate')
  }

  const payload = {}
  if (costPrice !== undefined) payload.costPrice = toDecimal(costPrice)
  if (priceRetail !== undefined) payload.priceRetail = toDecimal(priceRetail)
  if (source.wholesalePrice !== undefined || source.priceWholesale !== undefined) {
    payload.priceWholesale = toDecimal(source.wholesalePrice ?? source.priceWholesale)
  }
  if (source.technicianPrice !== undefined || source.priceTechnician !== undefined) {
    payload.priceTechnician = toDecimal(source.technicianPrice ?? source.priceTechnician)
  }
  if (source.priceOnline !== undefined) payload.priceOnline = toDecimal(source.priceOnline)
  if (effectiveDate !== undefined) payload.effectiveDate = effectiveDate
  if (expiredDate !== undefined) payload.expiredDate = expiredDate
  if (source.note !== undefined) payload.note = source.note || null
  if (typeof source.isActive === 'boolean') payload.isActive = source.isActive

  if (requireCorePrices && payload.isActive === undefined) payload.isActive = true
  return payload
}

const listPrices = async ({ productId, branchId } = {}) => {
  const productIdValue = repo.toInt(productId)
  if (!productIdValue) throw makeError('INVALID_PRODUCT_ID', 400)
  return repo.listProductPrices({ productId: productIdValue, branchId })
}

const savePrice = async ({
  productId,
  branchId,
  employeeId,
  role,
  v2Role,
  data = {},
  requireCorePrices = false,
} = {}) => {
  const productIdValue = repo.toInt(productId)
  const branchIdValue = repo.toInt(branchId)
  const employeeIdValue = repo.toInt(employeeId)

  if (!productIdValue) throw makeError('INVALID_PRODUCT_ID', 400)

  const payload = normalizePricePayload(data, { requireCorePrices })
  const authority = priceAuthorityPolicy.assertPricePayload({
    actor: {
      branchId: branchIdValue,
      employeeId: employeeIdValue,
      role,
      v2Role,
    },
    payload,
    effectiveDate: payload.effectiveDate,
    expiredDate: payload.expiredDate,
  })

  return repo.upsertBranchPrice({
    productId: productIdValue,
    branchId: authority.branchId,
    employeeId: authority.employeeId,
    payload,
  })
}

const removePrice = async ({ productId, priceId } = {}) => {
  const productIdValue = repo.toInt(productId)
  const priceIdValue = repo.toInt(priceId)
  if (!productIdValue) throw makeError('INVALID_PRODUCT_ID', 400)
  if (!priceIdValue) throw makeError('INVALID_PRICE_ID', 400)

  const existing = await repo.findProductPrice({ productId: productIdValue, priceId: priceIdValue })
  if (!existing) throw makeError('PRICE_NOT_FOUND', 404)
  await repo.deleteProductPrice({ productId: productIdValue, priceId: priceIdValue })
  return { ok: true, success: true, deletedId: priceIdValue }
}

module.exports = {
  listPrices,
  savePrice,
  removePrice,
}
