const { Prisma } = require('../../../../../lib/prisma')
const repo = require('../repositories/productPricingRepository')
const priceAuthorityPolicy = require('../policies/priceAuthorityPolicy')

const makeError = (code, status = 400, message = code, detail) => {
  const error = new Error(message)
  error.code = code
  error.status = status
  error.statusCode = status
  if (detail !== undefined) error.detail = detail
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

const normalizeActor = (input = {}) => {
  const source = input.actor || input
  return {
    branchId: repo.toInt(source.branchId),
    employeeId: repo.toInt(source.employeeId),
    role: source.role,
    v2Role: source.v2Role,
  }
}

const listPrices = async ({ productId, branchId } = {}) => {
  const productIdValue = repo.toInt(productId)
  const branchIdValue = repo.toInt(branchId)
  if (!productIdValue) throw makeError('INVALID_PRODUCT_ID', 400)
  if (!branchIdValue) throw makeError('PRICE_BRANCH_CONTEXT_REQUIRED', 403, 'ไม่พบสาขาของผู้ทำรายการ')
  return repo.listProductPrices({ productId: productIdValue, branchId: branchIdValue })
}

const savePrice = async ({ productId, data = {}, requireCorePrices = false, ...input } = {}) => {
  const productIdValue = repo.toInt(productId)
  if (!productIdValue) throw makeError('INVALID_PRODUCT_ID', 400)

  const payload = normalizePricePayload(data, { requireCorePrices })
  const authority = priceAuthorityPolicy.assertPricePayload({
    actor: normalizeActor(input),
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

const removePrice = async ({ productId, priceId, ...input } = {}) => {
  const productIdValue = repo.toInt(productId)
  const priceIdValue = repo.toInt(priceId)
  if (!productIdValue) throw makeError('INVALID_PRODUCT_ID', 400)
  if (!priceIdValue) throw makeError('INVALID_PRICE_ID', 400)

  const authority = priceAuthorityPolicy.assertActor(normalizeActor(input))
  if (!['OWNER', 'ADMIN', 'SUPERADMIN'].includes(authority.role)) {
    throw makeError(
      'PRICE_DELETE_FORBIDDEN',
      403,
      'บทบาทนี้ไม่มีสิทธิ์ลบราคา',
      { role: authority.role },
    )
  }

  const existing = await repo.findProductPrice({
    productId: productIdValue,
    priceId: priceIdValue,
    branchId: authority.branchId,
  })
  if (!existing) throw makeError('PRICE_NOT_FOUND', 404)

  await repo.deleteProductPrice({
    productId: productIdValue,
    priceId: priceIdValue,
    branchId: authority.branchId,
  })
  return { ok: true, success: true, deletedId: priceIdValue }
}

module.exports = {
  listPrices,
  savePrice,
  removePrice,
}
