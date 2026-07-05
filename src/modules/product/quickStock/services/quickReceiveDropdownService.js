// src/modules/product/quickStock/services/quickReceiveDropdownService.js
// Service for QuickStock dropdown workflow only.
// Borrowed Product Create's dropdown idea, but keeps QuickStock isolated.

const {
  TEMPLATE_BRANCH_CODE,
  QuickReceiveDropdownRepository,
  toInt,
} = require('../repositories/quickReceiveDropdownRepository')

const toBool = (value) => {
  if (typeof value === 'boolean') return value
  const v = String(value || '').trim().toLowerCase()
  return ['1', 'true', 'yes', 'y'].includes(v)
}

class QuickReceiveDropdownService {
  constructor(prisma, repository = null) {
    if (!prisma && !repository) {
      throw new Error('[QuickReceiveDropdownService] prisma or repository is required')
    }
    this.repository = repository || new QuickReceiveDropdownRepository(prisma)
  }

  async getDropdowns(params = {}) {
    const productTypeId = toInt(params.productTypeId)
    const includeInactive = toBool(params.includeInactive)

    const { templateBranch, productTypes } = await this.repository.listTemplateProductTypes({
      includeInactive,
    })

    if (!templateBranch?.id) {
      const error = new Error('ไม่พบ Template Branch สำหรับ QuickStock Dropdown')
      error.status = 404
      error.code = 'TEMPLATE_BRANCH_NOT_FOUND'
      throw error
    }

    const brands = productTypeId
      ? await this.repository.listBrandsForProductType({
          productTypeId,
          includeInactive,
        })
      : []

    const units = await this.repository.listUnits()

    return {
      success: true,
      workflow: 'quick-stock',
      source: 'template-product-type-catalog',
      templateBranchCode: templateBranch.branchCode || TEMPLATE_BRANCH_CODE,
      productTypes: productTypes.map((item) => ({
        id: item.id,
        name: item.name,
        active: item.active,
        branchId: item.branchId,
        categoryId: item.categoryId ?? item.globalProductType?.categoryId ?? null,
        globalProductTypeId: item.globalProductTypeId,
        category: item.category || null,
        globalProductType: item.globalProductType || null,
        source: 'TEMPLATE_PRODUCT_TYPE',
      })),
      brands: brands.map((item) => ({
        id: item.id,
        name: item.name,
        normalizedName: item.normalizedName,
        active: item.active,
      })),
      units: units.map((item) => ({
        id: item.id,
        name: item.name,
      })),
    }
  }
}

module.exports = {
  QuickReceiveDropdownService,
}
