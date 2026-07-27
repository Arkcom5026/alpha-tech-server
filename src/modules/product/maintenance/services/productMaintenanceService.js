const repo = require('../repositories/productMaintenanceRepository')
const { decideOperationalProductMode } = require('../../runtime/policies/operationalProductModePolicy')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const toNumberOrUndefined = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(typeof value === 'string' ? value.trim().replace(/,/g, '') : value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const normalizeText = (value) => (value == null ? '' : String(value)).trim()

const makeError = (code, status = 400) => {
  const error = new Error(code)
  error.code = code
  error.status = status
  error.statusCode = status
  return error
}

const pickBranchPricePayload = (data = {}) => {
  const nested = data.branchPrice && typeof data.branchPrice === 'object' ? data.branchPrice : {}
  const hasNested = ['costPrice', 'priceWholesale', 'priceTechnician', 'priceRetail', 'priceOnline', 'isActive']
    .some((key) => nested[key] !== undefined)

  if (hasNested) return nested

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

const assertOperationalTypeAndCategory = async ({ db, productTypeId, categoryId, branchId } = {}) => {
  const type = await repo.findOperationalProductType({ db, productTypeId, branchId })
  if (!type) throw makeError('PRODUCT_TYPE_NOT_FOUND_IN_BRANCH', 400)

  const derivedCategoryId = type.globalProductType?.categoryId ?? null
  if (categoryId && Number(categoryId) !== Number(derivedCategoryId)) {
    throw makeError('CATEGORY_TYPE_MISMATCH', 400)
  }

  return { productTypeId: Number(type.id), categoryId: derivedCategoryId }
}

const updateOperationalProduct = async ({ productId, branchId, data = {} } = {}) => {
  const id = toInt(productId)
  const brId = toInt(branchId)
  if (!id) throw makeError('INVALID_ID', 400)
  if (!brId) throw makeError('unauthorized', 401)

  const shouldOverrideMode = ['mode', 'stockMode', 'stockBehavior', 'noSN', 'trackSerialNumber', 'inventoryBehavior']
    .some((key) => data[key] !== undefined)

  let learnLater = null

  const result = await repo.transaction(async (tx) => {
    const current = await repo.findOperationalProductForUpdate({ db: tx, productId: id, branchId: brId })
    if (!current) throw makeError('NOT_FOUND', 404)

    const partialMode = shouldOverrideMode ? decideOperationalProductMode({
      explicitMode: data.mode ?? data.stockMode ?? data.stockBehavior ?? current.mode,
      noSN: data.noSN ?? current.noSN,
      trackSerialNumber: data.trackSerialNumber ?? current.trackSerialNumber,
      inventoryBehavior: data.inventoryBehavior ?? current.inventoryBehavior,
    }) : null
    const effectiveMode = partialMode?.mode ?? current.mode
    const saleBarcode = data.saleBarcode !== undefined ? (normalizeText(data.saleBarcode) || null) : current.saleBarcode
    if (saleBarcode && effectiveMode !== 'SIMPLE') throw makeError('SALE_BARCODE_REQUIRES_SIMPLE_MODE', 400)
    if (saleBarcode && await repo.findSaleBarcodeConflict({ db: tx, branchId: brId, saleBarcode, excludeProductId: id })) {
      throw makeError('SALE_BARCODE_ALREADY_EXISTS_IN_BRANCH', 409)
    }

    const incomingTypeId = toInt(data.productTypeId)
    const incomingCategoryId = toInt(data.categoryId)
    const effectiveTypeId = incomingTypeId ?? current.productTypeId

    const typeCheck = await assertOperationalTypeAndCategory({
      db: tx,
      productTypeId: effectiveTypeId,
      categoryId: incomingCategoryId,
      branchId: brId,
    })

    const saved = await repo.updateProduct({
      db: tx,
      productId: id,
      data: {
        name: data.name != null ? normalizeText(data.name) : undefined,
        ...(partialMode ? partialMode : {}),
        saleBarcode: data.saleBarcode !== undefined ? saleBarcode : undefined,
        active: typeof data.active === 'boolean' ? data.active : undefined,
        productTypeId: incomingTypeId !== undefined ? typeCheck.productTypeId : undefined,
        brandId: toInt(data.brandId),
        unitId: toInt(data.unitId),
      },
    })

    if (data.brandId !== undefined && data.brandId !== null && data.brandId !== '') {
      learnLater = { productTypeId: typeCheck.productTypeId, brandId: toInt(data.brandId) }
    }

    const branchPrice = pickBranchPricePayload(data)
    if (branchPrice) {
      await repo.upsertBranchPrice({
        db: tx,
        productId: id,
        branchId: brId,
        update: {
          costPrice: toNumberOrUndefined(branchPrice.costPrice),
          priceWholesale: toNumberOrUndefined(branchPrice.priceWholesale),
          priceTechnician: toNumberOrUndefined(branchPrice.priceTechnician),
          priceRetail: toNumberOrUndefined(branchPrice.priceRetail),
          priceOnline: toNumberOrUndefined(branchPrice.priceOnline),
          isActive: typeof branchPrice.isActive === 'boolean' ? branchPrice.isActive : undefined,
        },
        create: {
          costPrice: toNumberOrUndefined(branchPrice.costPrice) ?? 0,
          priceWholesale: toNumberOrUndefined(branchPrice.priceWholesale) ?? 0,
          priceTechnician: toNumberOrUndefined(branchPrice.priceTechnician) ?? 0,
          priceRetail: toNumberOrUndefined(branchPrice.priceRetail) ?? 0,
          priceOnline: toNumberOrUndefined(branchPrice.priceOnline) ?? 0,
          isActive: typeof branchPrice.isActive === 'boolean' ? branchPrice.isActive : true,
        },
      })
    }

    if (partialMode?.mode === 'SIMPLE' && partialMode.inventoryBehavior === 'TRACKED') {
      try {
        await repo.rebuildSimpleStockBalance({ db: tx, productId: id, branchId: brId })
      } catch (error) {
        console.warn('⚠️ rebuildSimpleStockBalance failed (non-fatal):', error?.message || error)
      }
    }

    return saved
  }, { timeout: 15000 })

  if (learnLater?.productTypeId && learnLater?.brandId) {
    try {
      await repo.ensureProductTypeBrand(learnLater)
    } catch (_error) {}
  }

  return result
}

module.exports = { updateOperationalProduct }
