// src/modules/product/update/services/productUpdateService.js

const repository = require('../repositories/productUpdateRepository')

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

const normalizeMode = ({ explicitMode, noSN, trackSerialNumber }) => {
  const raw = explicitMode == null ? '' : String(explicitMode).trim().toUpperCase()
  const n = noSN === true || noSN === 'true' || noSN === 1 || noSN === '1'
  const t = trackSerialNumber === true || trackSerialNumber === 'true' || trackSerialNumber === 1 || trackSerialNumber === '1'

  if (['SIMPLE', 'NOSN', 'NO_SN', 'NO-SN'].includes(raw)) {
    return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
  }
  if (['STRUCTURED', 'SN'].includes(raw)) {
    return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
  }
  if (trackSerialNumber !== undefined && t) {
    return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
  }
  if (noSN !== undefined && n) {
    return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
  }
  if (trackSerialNumber !== undefined && !t) {
    return { mode: 'SIMPLE', noSN: true, trackSerialNumber: false }
  }
  if (noSN !== undefined && !n) {
    return { mode: 'STRUCTURED', noSN: false, trackSerialNumber: true }
  }
  return null
}

const pickBranchPrice = (data = {}) => {
  const nested = data.branchPrice && typeof data.branchPrice === 'object' ? data.branchPrice : {}
  if (['costPrice', 'priceWholesale', 'priceTechnician', 'priceRetail', 'priceOnline', 'isActive']
    .some((key) => nested[key] !== undefined)) return nested

  const flat = {
    costPrice: data.costPrice,
    priceWholesale: data.priceWholesale,
    priceTechnician: data.priceTechnician,
    priceRetail: data.priceRetail,
    priceOnline: data.priceOnline,
    isActive: data.branchPriceActive ?? data.isActive,
  }
  return Object.values(flat).some((value) => value !== undefined) ? flat : null
}

const makeError = (code, status) => {
  const error = new Error(code)
  error.code = code
  error.status = status
  return error
}

const updateProduct = async ({ productId, branchId, data = {} } = {}) => {
  const id = toInt(productId)
  const brId = toInt(branchId)
  if (!id) throw makeError('INVALID_ID', 400)
  if (!brId) throw makeError('unauthorized', 401)

  const shouldOverrideMode = ['mode', 'stockMode', 'stockBehavior', 'noSN', 'trackSerialNumber']
    .some((key) => data[key] !== undefined)
  const mode = shouldOverrideMode
    ? normalizeMode({
        explicitMode: data.mode ?? data.stockMode ?? data.stockBehavior,
        noSN: data.noSN,
        trackSerialNumber: data.trackSerialNumber,
      })
    : null

  let typeBrand = null
  const result = await repository.prisma.$transaction(async (tx) => {
    const current = await repository.findBranchProduct({ db: tx, productId: id, branchId: brId })
    if (!current) throw makeError('NOT_FOUND', 404)

    const incomingTypeId = toInt(data.productTypeId)
    const effectiveTypeId = incomingTypeId || current.productTypeId
    const type = await repository.findBranchProductType({ db: tx, productTypeId: effectiveTypeId, branchId: brId })
    if (!type) throw makeError('PRODUCT_TYPE_NOT_FOUND_IN_BRANCH', 400)

    const incomingCategoryId = toInt(data.categoryId)
    const derivedCategoryId = type.globalProductType?.categoryId ?? null
    if (incomingCategoryId && Number(incomingCategoryId) !== Number(derivedCategoryId)) {
      throw makeError('CATEGORY_TYPE_MISMATCH', 400)
    }

    const saved = await repository.updateProduct({
      db: tx,
      productId: id,
      data: {
        name: data.name != null ? String(data.name).trim() : undefined,
        ...(mode || {}),
        active: typeof data.active === 'boolean' ? data.active : undefined,
        productTypeId: incomingTypeId ? type.id : undefined,
        brandId: data.brandId === null ? null : toInt(data.brandId),
        unitId: data.unitId === null ? null : toInt(data.unitId),
      },
    })

    const price = pickBranchPrice(data)
    if (price) {
      await repository.upsertBranchPrice({
        db: tx,
        productId: id,
        branchId: brId,
        update: {
          costPrice: toNum(price.costPrice),
          priceWholesale: toNum(price.priceWholesale),
          priceTechnician: toNum(price.priceTechnician),
          priceRetail: toNum(price.priceRetail),
          priceOnline: toNum(price.priceOnline),
          isActive: typeof price.isActive === 'boolean' ? price.isActive : undefined,
        },
        create: {
          productId: id,
          branchId: brId,
          costPrice: toNum(price.costPrice) ?? 0,
          priceWholesale: toNum(price.priceWholesale) ?? 0,
          priceTechnician: toNum(price.priceTechnician) ?? 0,
          priceRetail: toNum(price.priceRetail) ?? 0,
          priceOnline: toNum(price.priceOnline) ?? 0,
          isActive: typeof price.isActive === 'boolean' ? price.isActive : true,
        },
      })
    }

    const brandId = toInt(data.brandId)
    if (brandId) typeBrand = { productTypeId: type.id, brandId }
    return saved
  }, { timeout: 15000 })

  if (typeBrand) {
    await repository.ensureProductTypeBrand(typeBrand)
  }

  return result
}

module.exports = { updateProduct }
