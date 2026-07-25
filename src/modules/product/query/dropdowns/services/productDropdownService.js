// src/modules/product/query/dropdowns/services/productDropdownService.js

const repository = require('../repositories/productDropdownRepository')

const makeError = (code, status, message) => {
  const error = new Error(message || code)
  error.code = code
  error.status = status
  error.statusCode = status
  return error
}

const getDropdowns = async ({ branchId, includeInactive = false } = {}) => {
  const scopedBranchId = Number(branchId)
  if (!scopedBranchId) {
    throw makeError('BRANCH_REQUIRED', 400, 'ไม่พบข้อมูลสาขา')
  }

  const [types, unitsRaw, brandsRaw] = await Promise.all([
    repository.listProductTypes({ branchId: scopedBranchId }),
    repository.listUnits(),
    repository.listBrands({ includeInactive }),
  ])

  const productTypeIds = types.map((item) => Number(item.id)).filter(Boolean)
  const mappings = await repository.listProductTypeBrands({ productTypeIds })

  return {
    categories: [],
    productTypes: types.map((item) => ({
      id: Number(item.id),
      name: item.name,
      categoryId: item.globalProductType?.categoryId
        ? Number(item.globalProductType.categoryId)
        : null,
      globalProductTypeId:
        item.globalProductTypeId != null ? Number(item.globalProductTypeId) : null,
      branchId: Number(item.branchId),
    })),
    productProfiles: [],
    productTemplates: [],
    brands: brandsRaw.map((item) => ({
      id: Number(item.id),
      name: item.name,
      active: Boolean(item.active),
    })),
    units: unitsRaw.map((item) => ({ id: Number(item.id), name: item.name })),
    productTypeBrands: mappings.map((item) => ({
      productTypeId: Number(item.productTypeId),
      brandId: Number(item.brandId),
    })),
    productModes: [
      { code: 'SIMPLE', name: 'Simple' },
      { code: 'STRUCTURED', name: 'Structure' },
    ],
  }
}

module.exports = { getDropdowns }
