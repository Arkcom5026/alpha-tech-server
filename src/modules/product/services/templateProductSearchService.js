// src/modules/product/services/templateProductSearchService.js
// Product Template Search Service
// Business layer สำหรับค้นหา Product Template จาก Template Branch เช่น T01

const {
  DEFAULT_TEMPLATE_BRANCH_CODE,
  ProductTemplateRepository,
} = require('../repositories/productTemplateRepository')

const toPositiveInt = (value) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

const normalizeText = (value) => String(value || '').trim()

class TemplateProductSearchService {
  constructor(prisma, repository = null) {
    if (!prisma && !repository) {
      throw new Error('[TemplateProductSearchService] prisma or repository is required')
    }

    this.repository = repository || new ProductTemplateRepository(prisma)
  }

  getPagination(params = {}) {
    const takeRaw = toPositiveInt(params.takeNum) || toPositiveInt(params.take) || 100
    const take = Math.max(1, Math.min(takeRaw, 500))

    const skip =
      params.skipNum !== undefined && params.skipNum !== null
        ? Math.max(0, Number(params.skipNum) || 0)
        : Math.max(0, ((toPositiveInt(params.page) || 1) - 1) * take)

    return { take, skip }
  }

  mapTemplateProduct(product, templateBranch) {
    const bp = product.branchPrice?.[0] || null
    const cover = product.productImages?.[0] || null
    const category = product.productType?.globalProductType?.category || null

    return {
      id: product.id,
      name: product.name,
      active: typeof product.active === 'boolean' ? product.active : true,
      mode: product.mode,
      noSN: product.noSN,
      trackSerialNumber: product.trackSerialNumber,

      isTemplateProduct: true,
      templateProductId: product.id,
      templateBranchId: templateBranch.id,
      templateBranchCode: templateBranch.branchCode,

      categoryId: category?.id ?? product.productType?.globalProductType?.categoryId ?? null,
      categoryName: category?.name ?? null,
      category: category?.name ?? null,

      productTypeId: product.productTypeId ?? product.productType?.id ?? null,
      productTypeName: product.productType?.name ?? null,
      productType: product.productType?.name ?? null,

      brandId: product.brandId ?? product.brand?.id ?? null,
      brandName: product.brand?.name ?? null,

      unitId: product.unitId ?? product.unit?.id ?? null,
      unitName: product.unit?.name ?? null,
      unit: product.unit ? { id: product.unit.id, name: product.unit.name } : null,

      imageUrl: cover?.secure_url || cover?.url || null,

      costPrice: bp?.costPrice != null ? Number(bp.costPrice) : 0,
      priceRetail: bp?.priceRetail != null ? Number(bp.priceRetail) : 0,
      priceOnline: bp?.priceOnline != null ? Number(bp.priceOnline) : 0,
      priceTechnician: bp?.priceTechnician != null ? Number(bp.priceTechnician) : 0,
      priceWholesale: bp?.priceWholesale != null ? Number(bp.priceWholesale) : 0,
      hasPrice: !!bp,
      branchPriceActive: bp?.isActive ?? false,
    }
  }

  async searchTemplateProducts(params = {}) {
    const templateBranchCode =
      normalizeText(params.templateBranchCode || params.catalog || params.branchCode) ||
      DEFAULT_TEMPLATE_BRANCH_CODE

    const templateBranch = await this.repository.findTemplateBranchByCode(templateBranchCode)

    if (!templateBranch) {
      const err = new Error(`Template branch not found: ${templateBranchCode}`)
      err.statusCode = 404
      err.code = 'TEMPLATE_BRANCH_NOT_FOUND'
      throw err
    }

    const { take, skip } = this.getPagination(params)

    const products = await this.repository.searchTemplateProducts({
      templateBranchId: templateBranch.id,
      search: params.search,
      searchText: params.searchText,
      productTypeId: params.productTypeId,
      brandId: params.brandId,
      mode: params.mode,
      includeInactive: params.includeInactive,
      take,
      skip,
    })

    return products.map((product) => this.mapTemplateProduct(product, templateBranch))
  }
}

module.exports = {
  TemplateProductSearchService,
}
