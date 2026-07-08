// src/modules/product/create/services/productCreateService.js

const { prisma } = require('../../../../../lib/prisma')
const repo = require('../repositories/productCreateRepository')

const toInt = repo.toInt
const toMoneyOrNull = repo.toMoneyOrNull

const makeError = (code, status = 400, message = code) => {
  const error = new Error(message)
  error.status = status
  error.statusCode = status
  error.code = code
  return error
}

const normalizeMode = (value) => {
  const mode = String(value || 'STRUCTURED').trim().toUpperCase()
  if (['STRUCTURED', 'SIMPLE', 'LOT'].includes(mode)) return mode
  return 'STRUCTURED'
}

const getBranchContext = ({ branchId } = {}) => {
  const brId = toInt(branchId)
  if (!brId) throw makeError('BRANCH_ID_REQUIRED', 403)
  return brId
}

const getDropdowns = async ({ branchId, productTypeId, includeInactive = false } = {}) => {
  const brId = getBranchContext({ branchId })
  const productTypes = await repo.listBranchProductTypes({ branchId: brId, includeInactive })
  const units = await repo.listUnits()
  const brands = productTypeId
    ? await repo.listBrandsForProductType({ branchId: brId, productTypeId, includeInactive })
    : []

  return {
    success: true,
    data: {
      productTypes: productTypes.map((item) => ({
        id: item.id,
        name: item.name,
        active: item.active,
        branchId: item.branchId,
        categoryId: item.categoryId ?? item.globalProductType?.categoryId ?? null,
        globalProductTypeId: item.globalProductTypeId,
        category: item.category || null,
        globalProductType: item.globalProductType || null,
        source: 'BRANCH_PRODUCT_TYPE',
      })),
      brands: brands.map((item) => ({
        id: item.id,
        name: item.name,
        normalizedName: item.normalizedName,
        active: item.active,
      })),
      units: units.map((item) => ({ id: item.id, name: item.name })),
      categories: [],
    },
  }
}

const getBrands = async ({ branchId, productTypeId, includeInactive = false } = {}) => {
  const brId = getBranchContext({ branchId })
  const brands = await repo.listBrandsForProductType({ branchId: brId, productTypeId, includeInactive })

  return {
    success: true,
    items: brands.map((item) => ({
      id: item.id,
      name: item.name,
      normalizedName: item.normalizedName,
      active: item.active,
    })),
    total: brands.length,
  }
}

const getExistingModels = async ({ branchId, productTypeId, brandId, search, limit } = {}) => {
  const brId = getBranchContext({ branchId })
  const items = await repo.listExistingModels({
    branchId: brId,
    productTypeId,
    brandId,
    search,
    limit,
  })

  return {
    success: true,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      productTypeId: item.productTypeId,
      brandId: item.brandId,
      unitId: item.unitId,
      productType: item.productType,
      brand: item.brand,
      unit: item.unit,
    })),
    total: items.length,
  }
}

const validateCreatePayload = (data = {}) => {
  const name = String(data.name || '').trim()
  if (!name) throw makeError('PRODUCT_NAME_REQUIRED', 400)

  const productTypeId = toInt(data.productTypeId)
  if (!productTypeId) throw makeError('PRODUCT_TYPE_REQUIRED', 400)

  const brandId = toInt(data.brandId)
  if (!brandId) throw makeError('BRAND_REQUIRED', 400)

  const unitId = toInt(data.unitId)
  if (!unitId) throw makeError('UNIT_REQUIRED', 400)

  const branchPrice = data.branchPrice || {}
  const costPrice = toMoneyOrNull(branchPrice.costPrice)
  const priceRetail = toMoneyOrNull(branchPrice.priceRetail)

  if (costPrice === null || costPrice < 0) throw makeError('COST_PRICE_REQUIRED', 400)
  if (priceRetail === null || priceRetail <= 0) throw makeError('PRICE_RETAIL_REQUIRED', 400)

  return { name, productTypeId, brandId, unitId, branchPrice }
}

const createLocalOperationalProduct = async ({ branchId, employeeId, data = {} } = {}) => {
  const brId = getBranchContext({ branchId })
  const empId = toInt(employeeId)
  const validated = validateCreatePayload(data)
  const mode = normalizeMode(data.mode || data.stockMode || data.stockBehavior)

  const result = await prisma.$transaction(async (tx) => {
    const branchProductType = await repo.findBranchProductTypeById({
      db: tx,
      branchId: brId,
      productTypeId: validated.productTypeId,
    })

    if (!branchProductType?.id) {
      throw makeError('PRODUCT_TYPE_NOT_FOUND_FOR_BRANCH', 400)
    }

    await repo.ensureProductTypeBrand({
      db: tx,
      productTypeId: branchProductType.id,
      brandId: validated.brandId,
    })

    const product = await repo.createOperationalProduct({
      db: tx,
      data: {
        name: validated.name,
        active: typeof data.active === 'boolean' ? data.active : true,
        mode,
        noSN: Boolean(data.noSN),
        trackSerialNumber: mode === 'SIMPLE' ? false : data.trackSerialNumber !== false,
        templateProductId: null,
        productTypeId: branchProductType.id,
        categoryId: branchProductType.categoryId ?? branchProductType.globalProductType?.categoryId ?? null,
        brandId: validated.brandId,
        unitId: validated.unitId,
        codeType: data.codeType || 'D',
        productConfig: data.productConfig || undefined,
        warrantyDays: toInt(data.warrantyDays),
      },
    })

    const branchPrice = await repo.upsertBranchPrice({
      db: tx,
      productId: product.id,
      branchId: brId,
      payload: {
        ...validated.branchPrice,
        updatedBy: empId,
        note: 'Product Create Runtime',
      },
    })

    return { product, branchPrice, branchProductType }
  })

  return {
    success: true,
    product: {
      id: result.product.id,
      name: result.product.name,
      productTypeId: result.product.productTypeId,
      brandId: result.product.brandId,
      unitId: result.product.unitId,
      mode: result.product.mode,
      noSN: result.product.noSN,
      trackSerialNumber: result.product.trackSerialNumber,
      active: result.product.active,
      productType: result.product.productType,
      brand: result.product.brand,
      unit: result.product.unit,
    },
    branchPrice: result.branchPrice,
    runtime: {
      branchId: brId,
      ensuredProductTypeId: result.branchProductType.id,
      sourceProductTypeId: null,
      flow: 'PRODUCT_CREATE_RUNTIME',
    },
  }
}

module.exports = {
  getDropdowns,
  getBrands,
  getExistingModels,
  createLocalOperationalProduct,
}
