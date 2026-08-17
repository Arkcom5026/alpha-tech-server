const assert = require('node:assert/strict')

const {
  QuickReceiveDropdownRepository,
} = require('./quickReceiveDropdownRepository')

const originalPerfFlag = process.env.QUICK_STOCK_PERF_LOG
const originalConsoleLog = console.log

const logs = []
process.env.QUICK_STOCK_PERF_LOG = '1'
console.log = (...args) => logs.push(args.join(' '))

const prisma = {
  branch: {
    findFirst: async () => ({ id: 2, name: 'Template', branchCode: 'T01' }),
  },
  productType: {
    findMany: async () => [
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
    ],
  },
}

;(async () => {
  try {
    const repository = new QuickReceiveDropdownRepository(prisma)
    const result = await repository.listTemplateProductTypes()

    assert.equal(result.templateBranch.branchCode, 'T01')
    assert.equal(result.productTypes.length, 1)
    assert.equal(result.productTypes[0].id, 11)

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
  } finally {
    console.log = originalConsoleLog
    if (originalPerfFlag === undefined) delete process.env.QUICK_STOCK_PERF_LOG
    else process.env.QUICK_STOCK_PERF_LOG = originalPerfFlag
  }

  console.log('✅ QuickReceiveDropdownRepository performance breakdown contract passed')
})().catch((error) => {
  console.log = originalConsoleLog
  if (originalPerfFlag === undefined) delete process.env.QUICK_STOCK_PERF_LOG
  else process.env.QUICK_STOCK_PERF_LOG = originalPerfFlag
  console.error(error)
  process.exitCode = 1
})
