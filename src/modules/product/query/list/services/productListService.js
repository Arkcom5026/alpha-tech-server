// src/modules/product/query/list/services/productListService.js

const repository = require('../repositories/productListRepository')

const makeError = (code, status, message) => {
  const error = new Error(message || code)
  error.code = code
  error.status = status
  error.statusCode = status
  return error
}

const mapProduct = (product) => {
  const categoryName = product.productType?.globalProductType?.category?.name ?? '-'
  const productTypeName = product.productType?.name ?? '-'

  return {
    id: product.id,
    name: product.name,
    mode: product.mode,
    active: typeof product.active === 'boolean' ? product.active : true,
    spec: null,
    categoryId: product.productType?.globalProductType?.categoryId ?? null,
    productTypeId: product.productTypeId ?? null,
    productProfileId: null,
    templateId: null,
    productTemplateId: null,
    category: categoryName,
    productType: productTypeName,
    productProfile: '-',
    productTemplate: '-',
    categoryName,
    productTypeName,
    productProfileName: '-',
    productTemplateName: '-',
    brandId: product.brandId ?? product.brand?.id ?? null,
    brandName: product.brand?.name ?? null,
    unitId: product.unitId ?? product.unit?.id ?? null,
    unitName: product.unit?.name ?? null,
    unit: product.unit ? { id: product.unit.id, name: product.unit.name } : null,
    imageUrl: null,
  }
}

const listProducts = async ({ branchId, query = {} } = {}) => {
  const scopedBranchId = Number(branchId) || repository.toInt(query.branchId)
  if (!scopedBranchId) {
    throw makeError('BRANCH_REQUIRED', 400, 'ไม่พบข้อมูลสาขา')
  }

  const products = await repository.listOperationalProducts({
    branchId: scopedBranchId,
    search: query.search || '',
    take: query.take,
    page: query.page,
    categoryId: query.categoryId,
    productTypeId: query.productTypeId,
    brandId: query.brandId,
  })

  return products.map(mapProduct)
}

module.exports = {
  listProducts,
  mapProduct,
}
