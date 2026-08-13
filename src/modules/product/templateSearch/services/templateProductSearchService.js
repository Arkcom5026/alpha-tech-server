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
const normalizeProductTypeIdentity = (value) =>
  String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('th-TH')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '')

const OPTIONAL_PRICE_ERROR_CODES = new Set([
  'PRICE_VALUE_MISSING',
  'PRICE_VALUE_NOT_EFFECTIVE',
])

const toOptionalNumber = (value) => {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

class TemplateProductSearchService {
  constructor(prisma, repository = null) {
    if (!prisma && !repository) {
      throw new Error('[TemplateProductSearchService] prisma or repository is required')
    }

    this.prisma = prisma || repository?.prisma
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

  async resolveTemplateProductTypeId({ productTypeId, sourceBranchId, templateBranchId } = {}) {
    const requestedTypeId = toPositiveInt(productTypeId)
    if (!requestedTypeId) return { requested: false, templateProductTypeId: null }

    const sourceBranch = toPositiveInt(sourceBranchId)
    const templateBranch = toPositiveInt(templateBranchId)

    if (!this.prisma || !templateBranch || !sourceBranch || sourceBranch === templateBranch) {
      return { requested: true, templateProductTypeId: requestedTypeId }
    }

    const sourceType = await this.prisma.productType.findFirst({
      where: {
        id: requestedTypeId,
        branchId: sourceBranch,
      },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        globalProductTypeId: true,
      },
    })

    if (sourceType?.globalProductTypeId) {
      const sourceIdentity = normalizeProductTypeIdentity(
        sourceType.normalizedName || sourceType.name
      )
      const templateTypes = await this.prisma.productType.findMany({
        where: {
          branchId: templateBranch,
          globalProductTypeId: sourceType.globalProductTypeId,
        },
        select: {
          id: true,
          name: true,
          normalizedName: true,
        },
        orderBy: { id: 'asc' },
      })

      const templateType = templateTypes.find((candidate) =>
        sourceIdentity &&
        normalizeProductTypeIdentity(candidate.normalizedName || candidate.name) === sourceIdentity
      ) || null

      return {
        requested: true,
        templateProductTypeId: templateType?.id || null,
      }
    }

    const directTemplateType = await this.prisma.productType.findFirst({
      where: {
        id: requestedTypeId,
        branchId: templateBranch,
      },
      select: { id: true },
    })

    return {
      requested: true,
      templateProductTypeId: directTemplateType?.id || null,
    }
  }

  mapTemplateProduct(product, templateBranch) {
    const bp = product.branchPrice?.[0] || null

    const resolveOptionalPrice = (priceType) => {
      if (!bp) return null

      try {
        return effectivePricePolicy.resolveEffectivePrice({
          row: bp,
          priceType,
          branchId: templateBranch.id,
          productId: product.id,
        })
      } catch (error) {
        if (OPTIONAL_PRICE_ERROR_CODES.has(error?.code)) return null
        throw error
      }
    }

    const cover = product.productImages?.[0] || null
    const category = product.productType?.globalProductType?.category || null
    const costPrice = toOptionalNumber(bp?.costPrice)
    const priceRetail = resolveOptionalPrice('retail')
    const priceOnline = resolveOptionalPrice('online')
    const priceTechnician = resolveOptionalPrice('technician')
    const priceWholesale = resolveOptionalPrice('wholesale')

    const missingPriceFields = []
    if (costPrice === null) missingPriceFields.push('costPrice')
    if (priceRetail === null) missingPriceFields.push('priceRetail')
    if (priceWholesale === null) missingPriceFields.push('priceWholesale')
    if (priceTechnician === null) missingPriceFields.push('priceTechnician')
    if (priceOnline === null) missingPriceFields.push('priceOnline')

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
      globalProductTypeId: product.productType?.globalProductTypeId ?? null,
      brandId: product.brandId ?? product.brand?.id ?? null,
      brandName: product.brand?.name ?? null,
      unitId: product.unitId ?? product.unit?.id ?? null,
      unitName: product.unit?.name ?? null,
      unit: product.unit ? { id: product.unit.id, name: product.unit.name } : null,
      imageUrl: cover?.secure_url || cover?.url || null,
      costPrice,
      priceRetail,
      priceOnline,
      priceTechnician,
      priceWholesale,
      hasPrice: costPrice !== null && priceRetail !== null,
      priceReady: missingPriceFields.length === 0,
      missingPriceFields,
      branchPriceActive: bp?.isActive === true,
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

    const typeResolution = await this.resolveTemplateProductTypeId({
      productTypeId: params.productTypeId,
      sourceBranchId: params.sourceBranchId,
      templateBranchId: templateBranch.id,
    })

    if (typeResolution.requested && !typeResolution.templateProductTypeId) {
      return []
    }

    const { take, skip } = this.getPagination(params)
    const products = await this.repository.searchTemplateProducts({
      templateBranchId: templateBranch.id,
      search: params.search,
      searchText: params.searchText,
      productTypeId: typeResolution.templateProductTypeId,
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
  normalizeProductTypeIdentity,
  TemplateProductSearchService,
}
