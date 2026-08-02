'use strict'

const assert = require('assert')
const Module = require('module')

const runtimeServicePath = require.resolve('../src/modules/product/pricing/runtime/branchPriceRuntimeService')
const repositoryPath = require.resolve('../src/modules/product/pricing/runtime/branchPriceRuntimeRepository')

const calls = []
const repositoryStub = {
  D: (value) => value,
  findBranchProduct: async ({ productId, branchId }) => ({ id: productId, branchId }),
  upsertBranchPrice: async (input) => {
    calls.push({ type: 'single', input })
    return input
  },
  buildUpsertOperation: (input) => {
    calls.push({ type: 'build', input })
    return input
  },
  bulkUpsertBranchPrices: async ({ operations }) => {
    calls.push({ type: 'bulk', operations })
    return operations
  },
  findActiveBranchPrice: async () => null,
  findBranchPrices: async () => [],
  findProducts: async () => [],
  countProducts: async () => 0,
}

const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (parent?.filename === runtimeServicePath && request === './branchPriceRuntimeRepository') {
    return repositoryStub
  }
  return originalLoad.call(this, request, parent, isMain)
}

delete require.cache[runtimeServicePath]
delete require.cache[repositoryPath]
const service = require(runtimeServicePath)
Module._load = originalLoad

const owner = { branchId: 2, employeeId: 35, role: 'OWNER' }
const manager = { branchId: 2, employeeId: 36, role: 'MANAGER' }

;(async () => {
  await assert.rejects(
    () => service.upsertBranchPrice({
      actor: manager,
      input: { productId: 10, costPrice: 100, retailPrice: 150 },
    }),
    (error) => error.code === 'PRICE_MUTATION_FORBIDDEN',
  )
  assert.equal(calls.length, 0)

  await service.upsertBranchPrice({
    actor: owner,
    input: { productId: 10, costPrice: 100, retailPrice: 150 },
  })
  assert.equal(calls.filter((call) => call.type === 'single').length, 1)

  calls.length = 0
  await assert.rejects(
    () => service.updateMultipleBranchPrices({
      actor: manager,
      updates: [
        { productId: 10, priceRetail: 150 },
        { productId: 11, costPrice: 90, priceRetail: 140 },
      ],
    }),
    (error) => error.code === 'PRICE_MUTATION_FORBIDDEN',
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].type, 'build')

  calls.length = 0
  await assert.rejects(
    () => service.updateMultipleBranchPrices({
      actor: owner,
      updates: [{ priceRetail: 150 }],
    }),
    (error) => error.code === 'INVALID_PRODUCT_ID' && error.detail?.index === 0,
  )
  assert.equal(calls.length, 0)

  calls.length = 0
  await service.updateMultipleBranchPrices({
    actor: owner,
    updates: [
      { productId: 10, costPrice: 100, priceRetail: 150 },
      { productId: 11, costPrice: 90, priceRetail: 140 },
    ],
  })
  assert.equal(calls.filter((call) => call.type === 'build').length, 2)
  assert.equal(calls.filter((call) => call.type === 'bulk').length, 1)

  console.log('branch-price-runtime-authority.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
