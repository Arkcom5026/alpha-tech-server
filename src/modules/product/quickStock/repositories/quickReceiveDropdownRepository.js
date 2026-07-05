// src/modules/product/quickStock/repositories/quickReceiveDropdownRepository.js
// Repository for QuickStock dropdown workflow only.
// Pattern borrowed from Product Create, but intentionally isolated from Product Create code.

const TEMPLATE_BRANCH_CODE = 'T01'

const normalizeName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return null
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

const getProductTypeDedupeKey = (item = {}) => {
  if (item.globalProductTypeId) return `global:${item.globalProductTypeId}`

  const normalized =
    item.normalizedName ||
    item.globalProductType?.name ||
    item.name

  return `name:${normalizeName(normalized)}`
}

const dedupeProductTypes = (items = []) => {
  const byKey = new Map()

  items.forEach((item) => {
    if (!item?.id) return

    const key = getProductTypeDedupeKey(item)
    const existing = byKey.get(key)

    if (!existing) {
      byKey.set(key, item)
      return
    }

    // Prefer active row, then lower id as stable canonical dropdown value.
    if (!existing.active && item.active) {
      byKey.set(key, item)
      return
    }

    if (existing.active === item.active && Number(item.id) < Number(existing.id)) {
      byKey.set(key, item)
    }
  })

  return Array.from(byKey.values()).sort((a, b) => {
    const nameCompare = String(a.name || '').localeCompare(String(b.name || ''), 'th')
    if (nameCompare !== 0) return nameCompare
    return Number(a.id) - Number(b.id)
  })
}

class QuickReceiveDropdownRepository {
  constructor(prisma) {
    if (!prisma) {
      throw new Error('[QuickReceiveDropdownRepository] prisma is required')
    }
    this.prisma = prisma
  }

  async findTemplateBranchByCode(branchCode = TEMPLATE_BRANCH_CODE) {
    return this.prisma.branch.findFirst({
      where: { branchCode },
      select: { id: true, name: true, branchCode: true },
    })
  }

  async findProductTypeById(productTypeId) {
    const ptId = toInt(productTypeId)
    if (!ptId) return null

    return this.prisma.productType.findUnique({
      where: { id: ptId },
      include: {
        globalProductType: {
          select: { id: true, name: true, categoryId: true },
        },
        category: {
          select: { id: true, name: true },
        },
        productTypeBrands: {
          select: {
            brandId: true,
            brand: {
              select: {
                id: true,
                name: true,
                normalizedName: true,
                active: true,
              },
            },
          },
        },
      },
    })
  }

  async listTemplateProductTypes({ includeInactive = false } = {}) {
    const templateBranch = await this.findTemplateBranchByCode(TEMPLATE_BRANCH_CODE)
    if (!templateBranch?.id) return { templateBranch: null, productTypes: [] }

    const productTypes = await this.prisma.productType.findMany({
      where: {
        branchId: templateBranch.id,
        ...(includeInactive ? {} : { active: true }),
      },
      select: {
        id: true,
        name: true,
        active: true,
        branchId: true,
        categoryId: true,
        normalizedName: true,
        slug: true,
        globalProductTypeId: true,
        category: { select: { id: true, name: true } },
        globalProductType: { select: { id: true, name: true, categoryId: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    })

    return {
      templateBranch,
      productTypes: dedupeProductTypes(productTypes),
    }
  }

  async listBrandsForProductType({ productTypeId, includeInactive = false } = {}) {
    const sourceProductType = await this.findProductTypeById(productTypeId)
    if (!sourceProductType?.id) return []

    const globalProductTypeId = toInt(sourceProductType.globalProductTypeId)

    const productTypeWhere = globalProductTypeId
      ? {
          globalProductTypeId,
          ...(includeInactive ? {} : { active: true }),
        }
      : {
          OR: [
            { id: sourceProductType.id },
            { normalizedName: sourceProductType.normalizedName || normalizeName(sourceProductType.name) },
            { name: sourceProductType.name },
          ],
          ...(includeInactive ? {} : { active: true }),
        }

    const relatedProductTypes = await this.prisma.productType.findMany({
      where: productTypeWhere,
      select: { id: true },
    })

    const ids = relatedProductTypes.map((item) => item.id).filter(Boolean)
    if (!ids.length) return []

    const mappings = await this.prisma.productTypeBrand.findMany({
      where: {
        productTypeId: { in: ids },
        brand: includeInactive ? {} : { active: true },
      },
      select: {
        brand: {
          select: {
            id: true,
            name: true,
            normalizedName: true,
            active: true,
          },
        },
      },
      orderBy: { brand: { name: 'asc' } },
    })

    const byId = new Map()
    mappings.forEach((item) => {
      if (item.brand?.id) byId.set(item.brand.id, item.brand)
    })

    return Array.from(byId.values()).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'th')
    )
  }

  async listUnits() {
    return this.prisma.unit.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  }
}

module.exports = {
  TEMPLATE_BRANCH_CODE,
  normalizeName,
  toInt,
  dedupeProductTypes,
  QuickReceiveDropdownRepository,
}
