// src/modules/product/quickStock/services/quickReceiveDropdownService.js
// Service for QuickStock dropdown workflow only.
// Borrowed Product Create's dropdown idea, but keeps QuickStock isolated.

const {
  TEMPLATE_BRANCH_CODE,
  QuickReceiveDropdownRepository,
  toInt,
} = require('../repositories/quickReceiveDropdownRepository')

const DEFAULT_INITIAL_DROPDOWN_CACHE_TTL_MS = 15_000

const toBool = (value) => {
  if (typeof value === 'boolean') return value
  const v = String(value || '').trim().toLowerCase()
  return ['1', 'true', 'yes', 'y'].includes(v)
}

const readInitialDropdownCacheTtlMs = () => {
  const configured = Number.parseInt(process.env.QUICK_STOCK_INITIAL_DROPDOWN_CACHE_TTL_MS || '', 10)
  if (!Number.isFinite(configured) || configured < 0) return DEFAULT_INITIAL_DROPDOWN_CACHE_TTL_MS
  return configured
}

const nowMs = () => Number(process.hrtime.bigint()) / 1e6

const traceRead = async ({ enabled, label, startedAt, promise }) => {
  try {
    return await promise
  } finally {
    if (enabled) {
      const elapsedMs = nowMs() - startedAt
      console.info(`[quick-stock-perf] ${label}=${elapsedMs.toFixed(3)}ms`)
    }
  }
}

class QuickReceiveDropdownService {
  constructor(prisma, repository = null) {
    if (!prisma && !repository) {
      throw new Error('[QuickReceiveDropdownService] prisma or repository is required')
    }
    this.repository = repository || new QuickReceiveDropdownRepository(prisma)
    this.initialDropdownCache = new Map()
    this.initialDropdownInFlight = new Map()
  }

  invalidateInitialDropdownCache() {
    this.initialDropdownCache.clear()
    this.initialDropdownInFlight.clear()
  }

  async getDropdowns(params = {}) {
    const productTypeId = toInt(params.productTypeId)
    const includeInactive = toBool(params.includeInactive)
    const traceEnabled = process.env.QUICK_STOCK_PERF_TRACE === '1'

    // Product-type-specific reads include brands and remain live. The initial
    // payload is comparatively static and is safe to reuse for a short bounded
    // TTL. This removes repeated remote DB round-trips when operators revisit
    // Quick Stock while keeping catalog freshness bounded and configurable.
    if (!productTypeId) {
      const ttlMs = readInitialDropdownCacheTtlMs()
      const cacheKey = includeInactive ? 'initial:inactive' : 'initial:active'
      const now = Date.now()
      const cached = this.initialDropdownCache.get(cacheKey)

      if (ttlMs > 0 && cached && cached.expiresAt > now) {
        if (traceEnabled) console.info('[quick-stock-perf] initial-dropdown-cache=hit')
        return cached.value
      }

      const inFlight = this.initialDropdownInFlight.get(cacheKey)
      if (inFlight) {
        if (traceEnabled) console.info('[quick-stock-perf] initial-dropdown-cache=coalesced')
        return inFlight
      }

      const request = this.loadDropdownsFresh({ productTypeId: null, includeInactive, traceEnabled })
        .then((value) => {
          if (ttlMs > 0) {
            this.initialDropdownCache.set(cacheKey, {
              value,
              expiresAt: Date.now() + ttlMs,
            })
          }
          return value
        })
        .finally(() => {
          if (this.initialDropdownInFlight.get(cacheKey) === request) {
            this.initialDropdownInFlight.delete(cacheKey)
          }
        })

      this.initialDropdownInFlight.set(cacheKey, request)
      return request
    }

    return this.loadDropdownsFresh({ productTypeId, includeInactive, traceEnabled })
  }

  async loadDropdownsFresh({ productTypeId, includeInactive, traceEnabled }) {
    const totalStartedAt = nowMs()

    // These reads are independent for the initial Quick Stock payload. Start them
    // together so network/database latency is paid once instead of serially.
    const templateProductTypesStartedAt = nowMs()
    const templateProductTypesPromise = traceRead({
      enabled: traceEnabled,
      label: 'template-product-types',
      startedAt: templateProductTypesStartedAt,
      promise: this.repository.listTemplateProductTypes({ includeInactive }),
    })

    const unitsStartedAt = nowMs()
    const unitsPromise = traceRead({
      enabled: traceEnabled,
      label: 'units',
      startedAt: unitsStartedAt,
      promise: this.repository.listUnits(),
    })

    const brandsStartedAt = nowMs()
    const brandsPromise = productTypeId
      ? traceRead({
          enabled: traceEnabled,
          label: 'brands',
          startedAt: brandsStartedAt,
          promise: this.repository.listBrandsForProductType({
            productTypeId,
            includeInactive,
          }),
        })
      : Promise.resolve([])

    try {
      const [{ templateBranch, productTypes }, units, brands] = await Promise.all([
        templateProductTypesPromise,
        unitsPromise,
        brandsPromise,
      ])

      if (!templateBranch?.id) {
        const error = new Error('ไม่พบ Template Branch สำหรับ QuickStock Dropdown')
        error.status = 404
        error.code = 'TEMPLATE_BRANCH_NOT_FOUND'
        throw error
      }

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
    } finally {
      if (traceEnabled) {
        const totalElapsedMs = nowMs() - totalStartedAt
        console.info(`[quick-stock-perf] total=${totalElapsedMs.toFixed(3)}ms`)
      }
    }
  }
}

module.exports = {
  DEFAULT_INITIAL_DROPDOWN_CACHE_TTL_MS,
  readInitialDropdownCacheTtlMs,
  QuickReceiveDropdownService,
}
