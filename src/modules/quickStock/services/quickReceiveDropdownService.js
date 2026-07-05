// src/modules/quickStock/services/quickReceiveDropdownService.js
// Service for Quick Receive / QuickStock dropdown workflow only.

const {
  TEMPLATE_BRANCH_CODE,
  QuickReceiveDropdownRepository,
} = require('../repositories/quickReceiveDropdownRepository')

const toPositiveInt = (value) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

const normalizeName = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

const dedupeByName = (items = []) => {
  const seen = new Set()
  const result = []

  for (const item of Array.isArray(items) ? items : []) {
    const id = toPositiveInt(item?.id)
    const name = String(item?.name ?? '').trim()
    if (!id || !name) continue

    const key = normalizeName(name)
    if (!key || seen.has(key)) continue

    seen.add(key)
    result.push({ id, name })
  }

  return result.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'))
}

class QuickReceiveDropdownService {
  constructor(prisma, repository = null) {
    if (!prisma && !repository) {
      throw new Error('[QuickReceiveDropdownService] prisma or repository is required')
    }
    this.repository = repository || new QuickReceiveDropdownRepository(prisma)
  }

  async getDropdowns(params = {}) {
    const productTypeId = toPositiveInt(params.productTypeId)
    const templateBranch = await this.repository.findTemplateBranchByCode(TEMPLATE_BRANCH_CODE)

    if (!templateBranch?.id) {
      const error = new Error('ไม่พบ Template Branch สำหรับ Quick Receive Dropdown')
      error.status = 404
      error.code = 'TEMPLATE_BRANCH_NOT_FOUND'
      throw error
    }

    const rows = await this.repository.findTemplateCatalogDropdownRows({
      templateBranchId: templateBranch.id,
      productTypeId,
    })

    const productTypes = dedupeByName(rows.map((row) => row.productType).filter(Boolean))
    const brands = dedupeByName(
      rows
        .map((row) => row.brand)
        .filter((brand) => brand && brand.active !== false)
    )
    const units = dedupeByName(rows.map((row) => row.unit).filter(Boolean))

    return {
      success: true,
      workflow: 'quick-receive',
      source: 'template-catalog',
      templateBranchCode: templateBranch.branchCode,
      productTypes,
      brands,
      units,
    }
  }
}

module.exports = {
  QuickReceiveDropdownService,
}
