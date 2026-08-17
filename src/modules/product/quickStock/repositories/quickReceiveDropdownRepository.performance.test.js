const assert = require('node:assert/strict')

const {
  QuickReceiveDropdownRepository,
} = require('./quickReceiveDropdownRepository')

const originalPerfFlag = process.env.QUICK_STOCK_PERF_TRACE
const originalCacheTtl = process.env.QUICK_STOCK_TEMPLATE_BRANCH_CACHE_TTL_MS
const originalConsoleInfo = console.info

const logs = []
const calls = {
  branchFindFirst: 0,
  productTypeFindMany: 0,
}

process.env.QUICK_STOCK_PERF_TRACE = '1'
process.env.QUICK_STOCK_TEMPLATE_BRANCH_CACHE_TTL_MS = '60000'
console.info = (...args) => logs.push(args.join(' '))

const prisma = {
  branch: {
    findFirst: async () => {
      calls.branchFindFirst += 1
      return { id: 2, name: 'Template', branchCode: 'T01' }
    },
  },
  productType: {
    findMany: async () => {
      calls.productTypeFindMany += 1
      return [
        {
          id: 11,
          name: 'Ink',
          active: true,
          branchId: 2,
          normalizedName: 'ink',
          globalProductTypeId: 101,
          globalProductType: { id: 101, name: 'Ink', categoryId: 7 },
        },
        {
          id: 12,
          name: 'Ink',
          active: true,
          branchId: 2,
          normalizedName: 'ink',
          globalProductTypeId: 101,
          globalProductType: { id: 101, name: 'Ink', categoryId: 7 },
        },
      ]
    },
  },
}

const restore = () => {
  console.info = originalConsoleInfo

  if (originalPerfFlag === undefined) delete process.env.QUICK_STOCK_PERF_TRACE
  else process.env.QUICK_STOCK_PERF_TRACE = originalPerfFlag

  if (originalCacheTtl === undefined) delete process.env.QUICK_STOCK_TEMPLATE_BRANCH_CACHE_TTL_MS
  else process.env.QUICK_STOCK_TEMPLATE_BRANCH_CACHE_TTL_MS = originalCacheTtl
}

;(async () => {
  try {
    const repository = new QuickReceiveDropdownRepository(prisma)
    const first = await repository.listTemplateProductTypes()
    const second = await repository.listTemplateProductTypes()

    assert.equal(first.templateBranch.branchCode, 'T01')
    assert.equal(first.productTypes.length, 1)
    assert.equal(first.productTypes[0].id, 11)
    assert.equal(second.productTypes.length, 1)

    const labels = logs.map((line) => line.split('=')[0])
    assert.ok(labels.includes('[quick-stock-perf] template-branch-lookup'))
    assert.ok(labels.includes('[quick-stock-perf] template-product-type-query'))
    assert.ok(labels.includes('[quick-stock-perf] template-product-type-dedupe-sort'))
    assert.ok(labels.includes('[quick-stock-perf] template-product-types-total'))

    assert.ok(logs.some((line) => line.includes('template-product-type-query=') && line.includes('rows=2')))
    assert.ok(
      logs.some(
        (line) =>
          line.includes('template-product-type-dedupe-sort=') &&
          line.includes('rows=2') &&
          line.includes('deduped=1')
      )
    )

    assert.equal(calls.branchFindFirst, 1, 'template branch lookup should be reused within the TTL')
    assert.equal(calls.productTypeFindMany, 2, 'product type rows must remain fresh and must not be cached')

    repository.invalidateTemplateBranchCache('T01')
    await repository.listTemplateProductTypes()

    assert.equal(calls.branchFindFirst, 2, 'cache invalidation must force a fresh branch authority lookup')
    assert.equal(calls.productTypeFindMany, 3)
  } finally {
    restore()
  }

  console.log('✅ QuickReceiveDropdownRepository performance breakdown and branch cache contract passed')
})().catch((error) => {
  restore()
  console.error(error)
  process.exitCode = 1
})
