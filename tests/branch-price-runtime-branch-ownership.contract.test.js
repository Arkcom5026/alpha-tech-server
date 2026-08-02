'use strict'

const assert = require('assert')
const Module = require('module')

const servicePath = require.resolve('../src/modules/product/pricing/runtime/branchPriceRuntimeService')
const repositoryPath = require.resolve('../src/modules/product/pricing/runtime/branchPriceRuntimeRepository')

const originalLoad = Module._load
let persisted = false
let branchLookup = []

const repositoryStub = {
  D: (value) => value,
  findBranchProduct: async ({ productId, branchId }) => {
    branchLookup.push({ productId, branchId })
    return productId === 101 && branchId === 2 ? { id: 101 } : null
  },
  upsertBranchPrice: async () => {
    persisted = true
    return { id: 1 }
  },
  buildUpsertOperation: (input) => input,
  bulkUpsertBranchPrices: async ({ operations }) => {
    persisted = true
    return operations.length
  },
  findActiveBranchPrice: async () => null,
  findProducts: async () => [],
  countProducts: async () => 0,
  findBranchPrices: async () => [],
}

Module._load = function patchedLoad(request, parent, isMain) {
  const resolved = Module._resolveFilename(request, parent, isMain)
  if (resolved === repositoryPath) return repositoryStub
  return originalLoad.apply(this, arguments)
}

delete require.cache[servicePath]
const service = require(servicePath)

const owner = { branchId: 2, employeeId: 35, role: 'OWNER' }

async function main() {
  await assert.rejects(
    service.upsertBranchPrice({ actor: owner, input: { productId: 999, costPrice: 100, priceRetail: 150 } }),
    (error) => error.code === 'PRICE_PRODUCT_NOT_FOUND_IN_BRANCH'
      && error.status === 404
      && error.detail?.productId === 999
      && error.detail?.branchId === 2,
  )
  assert.equal(persisted, false)

  await service.upsertBranchPrice({
    actor: owner,
    input: { productId: 101, costPrice: 100, priceRetail: 150 },
  })
  assert.equal(persisted, true)

  persisted = false
  branchLookup = []
  await assert.rejects(
    service.updateMultipleBranchPrices({
      actor: owner,
      updates: [
        { productId: 101, costPrice: 100, priceRetail: 150 },
        { productId: 999, costPrice: 110, priceRetail: 160 },
      ],
    }),
    (error) => error.code === 'PRICE_PRODUCT_NOT_FOUND_IN_BRANCH'
      && error.detail?.index === 1
      && error.detail?.productId === 999,
  )
  assert.equal(persisted, false)
  assert.deepEqual(branchLookup, [
    { productId: 101, branchId: 2 },
    { productId: 999, branchId: 2 },
  ])

  console.log('branch-price-runtime-branch-ownership.contract.test.js: PASS')
}

main()
  .finally(() => {
    Module._load = originalLoad
    delete require.cache[servicePath]
  })
