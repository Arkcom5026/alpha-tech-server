// src/modules/product/templateSearch/services/templateProductSearchService.js
// Capability-owned compatibility boundary for Product Template search business flow.

const {
  DEFAULT_TEMPLATE_BRANCH_CODE,
  ProductTemplateRepository,
} = require('../repositories/productTemplateSearchRepository')
const effectivePricePolicy = require('../../pricing/policies/effectivePricePolicy')

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
    if (!bp) {
      const error = new Error('ไม่พบราคาที่ใช้งานสำหรับสินค้าแม่แบบนี้')
      error.code = 'ACTIVE_BRANCH_PRICE_NOT_FOUND'
      error.status = 409
      error.statusCode = 409
      error.detail = { branchId: templateBranch.id, productId: product.id }
      throw error
    }

    const resolve = (priceType) => effectivePricePolicy.resolveEffectivePrice({
      row: bp,
      priceType,
      branchId: templateBranch.id,
      productId: product.id,
    })

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
      costPrice: Number(bp.costPrice),
      priceRetail: resolve('retail'),
      priceOnline: resolve('online'),
      priceTechnician: resolve('technician'),
      priceWholesale: resolve('wholesale'),
      hasPrice: true,
      branchPriceActive: bp.isActive === true,
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
