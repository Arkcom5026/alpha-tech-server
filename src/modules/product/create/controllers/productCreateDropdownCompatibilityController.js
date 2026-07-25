// Compatibility transport for legacy Product dropdown endpoints.
// Runtime ownership belongs to product/create.

const productCreateRepository = require('../repositories/productCreateRepository')

const toInt = productCreateRepository.toInt

const getBranchId = (req) =>
  Number(req.user?.branchId) ||
  toInt(req.query?.branchId) ||
  null

const getProductDropdowns = async (req, res) => {
  try {
    const includeInactive = String(req.query?.includeInactive ?? 'false').toLowerCase() === 'true'
    const branchId = getBranchId(req)

    if (!branchId) {
      return res.status(400).json({ error: 'BRANCH_REQUIRED', message: 'ไม่พบข้อมูลสาขา' })
    }

    const [types, unitsRaw, brandsRaw] = await Promise.all([
      productCreateRepository.listBranchProductTypes({ branchId, includeInactive: true }),
      productCreateRepository.listUnits(),
      productCreateRepository.listAllBrands({ includeInactive }),
    ])

    const scopedProductTypeIds = types.map((item) => Number(item.id)).filter(Boolean)
    const productTypeBrandsRaw = await productCreateRepository.listProductTypeBrandMappings({
      productTypeIds: scopedProductTypeIds,
    })

    const productTypes = types.map((item) => ({
      id: Number(item.id),
      name: item.name,
      categoryId: item.globalProductType?.categoryId
        ? Number(item.globalProductType.categoryId)
        : null,
      globalProductTypeId: item.globalProductTypeId != null
        ? Number(item.globalProductTypeId)
        : null,
      branchId: Number(item.branchId),
    }))

    const brands = (brandsRaw || []).map((item) => ({
      id: Number(item.id),
      name: item.name,
      active: !!item.active,
    }))

    const units = (unitsRaw || []).map((item) => ({
      id: Number(item.id),
      name: item.name,
    }))

    const productTypeBrands = (productTypeBrandsRaw || []).map((item) => ({
      productTypeId: Number(item.productTypeId),
      brandId: Number(item.brandId),
    }))

    return res.json({
      categories: [],
      productTypes,
      productProfiles: [],
      productTemplates: [],
      brands,
      units,
      productTypeBrands,
      productModes: [
        { code: 'SIMPLE', name: 'Simple' },
        { code: 'STRUCTURED', name: 'Structure' },
      ],
    })
  } catch (error) {
    console.error('❌ getProductDropdowns error:', error)
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' })
  }
}

module.exports = {
  getProductDropdowns,
}
