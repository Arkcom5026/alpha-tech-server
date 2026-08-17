const assert = require('node:assert/strict')

const {
  QuickReceiveDropdownRepository,
} = require('./quickReceiveDropdownRepository')

const originalPerfFlag = process.env.QUICK_STOCK_PERF_TRACE
const originalConsoleInfo = console.info

const logs = []
process.env.QUICK_STOCK_PERF_TRACE = '1'
console.info = (...args) => logs.push(args.join(' '))

let branchQueryCount = 0
let productTypeQueryCount = 0
let capturedBranchArgs = null

const prisma = {
  branch: {
    findFirst: async (args) => {
      branchQueryCount += 1
      capturedBranchArgs = args
      return {
        id: 2,
        name: 'Template',
        branchCode: 'T01',
        productTypes: [
          {
            id: 12,
            name: 'Ink',
            active: true,
            branchId: 2,
            normalizedName: 'ink',
            globalProductTypeId: 101,
            globalProductType: { id: 101, name: 'Ink', categoryId: 7 },
          },
          {
            id: 11,
            name: 'Ink',
            active: true,
            branchId: 2,
            normalizedName: 'ink',
            globalProductTypeId: 101,
            globalProductType: { id: 101, name: 'Ink', categoryId: 7 },
          },
        ],
      }
    },
  },
  productType: {
    findMany: async () => {
      productTypeQueryCount += 1
      throw new Error('listTemplateProductTypes must not issue a second productType query')
    },
  },
}

const restore = () => {
  console.info = originalConsoleInfo
  if (originalPerfFlag === undefined) delete process.env.QUICK_STOCK_PERF_TRACE
  else process.env.QUICK_STOCK_PERF_TRACE = originalPerfFlag
}

;(async () => {
  try {
    const repository = new QuickReceiveDropdownRepository(prisma)
    const result = await repository.listTemplateProductTypes()

    assert.equal(branchQueryCount, 1)
    assert.equal(productTypeQueryCount, 0)
    assert.equal(capturedBranchArgs.where.branchCode, 'T01')
    assert.deepEqual(capturedBranchArgs.select.productTypes.where, { active: true })

    assert.deepEqual(result.templateBranch, {
      id: 2,
      name: 'Template',
      branchCode: 'T01',
    })
    assert.equal(result.productTypes.length, 1)
    assert.equal(result.productTypes[0].id, 11)

    const labels = logs.map((line) => line.split('=')[0])
    assert.ok(labels.includes('[quick-stock-perf] template-branch-product-types-query'))
    assert.ok(labels.includes('[quick-stock-perf] template-product-type-dedupe-sort'))
    assert.ok(labels.includes('[quick-stock-perf] template-product-types-total'))
    assert.ok(!labels.includes('[quick-stock-perf] template-branch-lookup'))
    assert.ok(!labels.includes('[quick-stock-perf] template-product-type-query'))

    assert.ok(
      logs.some(
        (line) =>
          line.includes('template-branch-product-types-query=') &&
          line.includes('found=true') &&
          line.includes('rows=2')
      )
    )

    const missingRepository = new QuickReceiveDropdownRepository({
      branch: { findFirst: async () => null },
    })
    assert.deepEqual(await missingRepository.listTemplateProductTypes(), {
      templateBranch: null,
      productTypes: [],
    })
  } finally {
    restore()
  }

  console.log('✅ QuickReceiveDropdownRepository single-query template catalog contract passed')
})().catch((error) => {
  restore()
  console.error(error)
  process.exitCode = 1
})
