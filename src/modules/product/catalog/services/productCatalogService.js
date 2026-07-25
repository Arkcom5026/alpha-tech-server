const productCatalogRepository = require('../repositories/productCatalogRepository')

const toInt = (value) => (
  value === undefined || value === null || value === ''
    ? undefined
    : Number.parseInt(value, 10)
)

const buildOperationalCatalogWhere = ({ branchId, search, categoryId, productTypeId, brandId }) => {
  const whereAND = [
    {
      productType: {
        branchId,
      },
    },
  ]

  if (search) {
    whereAND.push({
      OR: [{ name: { contains: String(search), mode: 'insensitive' } }],
    })
  }

  if (categoryId) {
    whereAND.push({
      productType: {
        globalProductType: { categoryId },
      },
    })
  }

  if (productTypeId) whereAND.push({ productTypeId })
  if (brandId) whereAND.push({ brandId })

  return { AND: whereAND }
}

const mapOperationalCatalogProduct = (product) => {
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

const listOperationalProducts = async (input, dependencies = {}) => {
  const repository = dependencies.repository || productCatalogRepository
  const branchId = Number(input.branchId) || toInt(input.queryBranchId)

  if (!branchId) {
    const error = new Error('ไม่พบข้อมูลสาขา')
    error.code = 'BRANCH_REQUIRED'
    error.statusCode = 400
    throw error
  }

  const take = Math.max(1, Math.min(toInt(input.take) ?? 100, 200))
  const page = toInt(input.page)
  const skip = Math.max(0, page ? (page - 1) * take : 0)
  const categoryId = toInt(input.categoryId)
  const productTypeId = toInt(input.productTypeId)
  const brandId = toInt(input.brandId)

  const where = buildOperationalCatalogWhere({
    branchId,
    search: input.search || '',
    categoryId,
    productTypeId,
    brandId,
  })

  await repository.countOperationalProducts({ where })
  const products = await repository.findOperationalProducts({ where, take, skip })

  return products.map(mapOperationalCatalogProduct)
}

module.exports = {
  listOperationalProducts,
  buildOperationalCatalogWhere,
  mapOperationalCatalogProduct,
}
