const assert = require('node:assert/strict')

const {
  QuickReceiveDropdownService,
} = require('./quickReceiveDropdownService')

const originalTtl = process.env.QUICK_STOCK_INITIAL_DROPDOWN_CACHE_TTL_MS
process.env.QUICK_STOCK_INITIAL_DROPDOWN_CACHE_TTL_MS = '60000'

const counts = {
  productTypes: 0,
  units: 0,
  brands: 0,
}

const repository = {
  async listTemplateProductTypes() {
    counts.productTypes += 1
    await new Promise((resolve) => setTimeout(resolve, 5))
    return {
      templateBranch: { id: 1, branchCode: 'T01' },
      productTypes: [
        {
          id: 11,
          name: 'Printer',
          active: true,
          branchId: 1,
          globalProductTypeId: 101,
          globalProductType: { id: 101, name: 'Printer', categoryId: 7 },
        },
      ],
    }
  },
  async listUnits() {
    counts.units += 1
    await new Promise((resolve) => setTimeout(resolve, 5))
    return [{ id: 1, name: 'ชิ้น' }]
  },
  async listBrandsForProductType() {
    counts.brands += 1
    return [{ id: 3, name: 'HP', normalizedName: 'hp', active: true }]
  },
}

;(async () => {
  try {
    const service = new QuickReceiveDropdownService(null, repository)

    const [first, concurrent] = await Promise.all([
      service.getDropdowns({}),
      service.getDropdowns({}),
    ])

    assert.deepEqual(first, concurrent)
    assert.equal(counts.productTypes, 1, 'concurrent initial reads must share one product type query')
    assert.equal(counts.units, 1, 'concurrent initial reads must share one unit query')

    const cached = await service.getDropdowns({})
    assert.deepEqual(cached, first)
    assert.equal(counts.productTypes, 1, 'completed initial payload must be reused inside TTL')
    assert.equal(counts.units, 1, 'completed unit payload must be reused inside TTL')

    await service.getDropdowns({ productTypeId: 11 })
    await service.getDropdowns({ productTypeId: 11 })
    assert.equal(counts.productTypes, 3, 'product-type-specific reads must remain live')
    assert.equal(counts.units, 3, 'product-type-specific unit reads must remain live')
    assert.equal(counts.brands, 2, 'brand reads must remain live')

    service.invalidateInitialDropdownCache()
    await service.getDropdowns({})
    assert.equal(counts.productTypes, 4, 'explicit invalidation must force a fresh initial read')
    assert.equal(counts.units, 4, 'explicit invalidation must force a fresh unit read')

    console.log('✅ QuickReceiveDropdownService initial payload cache contract passed')
  } finally {
    if (originalTtl === undefined) delete process.env.QUICK_STOCK_INITIAL_DROPDOWN_CACHE_TTL_MS
    else process.env.QUICK_STOCK_INITIAL_DROPDOWN_CACHE_TTL_MS = originalTtl
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
