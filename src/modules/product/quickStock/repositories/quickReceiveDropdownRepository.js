// src/modules/product/quickStock/repositories/quickReceiveDropdownRepository.js
// Repository for QuickStock dropdown workflow only.
// Pattern borrowed from Product Create, but intentionally isolated from Product Create code.

const { performance } = require('node:perf_hooks')

const TEMPLATE_BRANCH_CODE = 'T01'
const DEFAULT_TEMPLATE_BRANCH_CACHE_TTL_MS = 60_000

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

const readTemplateBranchCacheTtlMs = () => {
  const configured = Number.parseInt(process.env.QUICK_STOCK_TEMPLATE_BRANCH_CACHE_TTL_MS || '', 10)
  if (!Number.isFinite(configured) || configured < 0) return DEFAULT_TEMPLATE_BRANCH_CACHE_TTL_MS
  return configured
}

const isPerfTraceEnabled = () => process.env.QUICK_STOCK_PERF_TRACE === '1'
const formatDuration = (startedAt) => `${(performance.now() - startedAt).toFixed(3)}ms`
const logPerf = (label, startedAt, details = '') => {
  if (!isPerfTraceEnabled()) return
  const suffix = details ? ` ${details}` : ''
  console.info(`[quick-stock-perf] ${label}=${formatDuration(startedAt)}${suffix}`)
}

const getProductTypeDedupeKey = (item = {}) => {
  const globalProductTypeId = toInt(item.globalProductTypeId)
  const normalized = item.normalizedName || item.name
  return `global:${globalProductTypeId || 'none'}:${normalizeName(normalized)}`
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
    if (!prisma) throw new Error('[QuickReceiveDropdownRepository] prisma is required')
    this.prisma = prisma
    this.templateBranchCache = new Map()
  }

  invalidateTemplateBranchCache(branchCode) {
    if (branchCode) {
      this.templateBranchCache.delete(String(branchCode))
      return
    }
    this.templateBranchCache.clear()
  }

  async findTemplateBranchByCode(branchCode = TEMPLATE_BRANCH_CODE) {
    const cacheKey = String(branchCode)
    const ttlMs = readTemplateBranchCacheTtlMs()
    const now = Date.now()
    const cached = this.templateBranchCache.get(cacheKey)

    if (ttlMs > 0 && cached && cached.expiresAt > now) return cached.value

    const branch = await this.prisma.branch.findFirst({
      where: { branchCode },
      select: { id: true, name: true, branchCode: true },
    })

    if (ttlMs > 0 && branch?.id) {
      this.templateBranchCache.set(cacheKey, { value: branch, expiresAt: now + ttlMs })
    } else {
      this.templateBranchCache.delete(cacheKey)
    }

    return branch
  }

  async findProductTypeById(productTypeId) {
    const ptId = toInt(productTypeId)
    if (!ptId) return null

    return this.prisma.productType.findUnique({
      where: { id: ptId },
      include: {
        globalProductType: { select: { id: true, name: true, categoryId: true } },
        productTypeBrands: {
          select: {
            brandId: true,
            brand: { select: { id: true, name: true, normalizedName: true, active: true } },
          },
        },
      },
    })
  }

  async listTemplateProductTypes({ includeInactive = false } = {}) {
    const totalStartedAt = performance.now()
    const branchStartedAt = performance.now()
    const templateBranch = await this.findTemplateBranchByCode(TEMPLATE_BRANCH_CODE)
    logPerf('template-branch-lookup', branchStartedAt, `found=${Boolean(templateBranch?.id)}`)

    if (!templateBranch?.id) {
      logPerf('template-product-types-total', totalStartedAt, 'rows=0 deduped=0')
      return { templateBranch: null, productTypes: [] }
    }

    const queryStartedAt = performance.now()
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
        normalizedName: true,
        globalProductTypeId: true,
        globalProductType: { select: { id: true, name: true, categoryId: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    })
    logPerf('template-product-type-query', queryStartedAt, `rows=${productTypes.length}`)

    const dedupeStartedAt = performance.now()
    const dedupedProductTypes = dedupeProductTypes(productTypes)
    logPerf('template-product-type-dedupe-sort', dedupeStartedAt, `rows=${productTypes.length} deduped=${dedupedProductTypes.length}`)
    logPerf('template-product-types-total', totalStartedAt, `rows=${productTypes.length} deduped=${dedupedProductTypes.length}`)

    return { templateBranch, productTypes: dedupedProductTypes }
  }

  async listBrandsForProductType({ productTypeId, includeInactive = false } = {}) {
    const sourceProductType = await this.findProductTypeById(productTypeId)
    if (!sourceProductType?.id) return []

    const globalProductTypeId = toInt(sourceProductType.globalProductTypeId)
    const productTypeWhere = globalProductTypeId
      ? { globalProductTypeId, ...(includeInactive ? {} : { active: true }) }
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
        brand: { select: { id: true, name: true, normalizedName: true, active: true } },
      },
      orderBy: { brand: { name: 'asc' } },
    })

    const byId = new Map()
    mappings.forEach((item) => {
      if (item.brand?.id) byId.set(item.brand.id, item.brand)
    })

    return Array.from(byId.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'))
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
  DEFAULT_TEMPLATE_BRANCH_CACHE_TTL_MS,
  normalizeName,
  toInt,
  readTemplateBranchCacheTtlMs,
  dedupeProductTypes,
  QuickReceiveDropdownRepository,
}
