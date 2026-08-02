'use strict'

const assert = require('assert')
const Module = require('module')

const servicePath = require.resolve('../src/modules/product/pricing/services/productPricingService')
const repoPath = require.resolve('../src/modules/product/pricing/repositories/productPricingRepository')

const calls = []
const fakeRepo = {
  toInt: (value) => Number(value),
  upsertBranchPrice: async (input) => {
    calls.push(input)
    return input
  },
  listProductPrices: async () => [],
  findProductPrice: async () => null,
  deleteProductPrice: async () => undefined,
}

const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  const resolved = parent ? Module._resolveFilename(request, parent, isMain) : request
  if (resolved === repoPath) return fakeRepo
  return originalLoad.apply(this, arguments)
}

delete require.cache[servicePath]
const service = require(servicePath)

async function main() {
  await assert.rejects(
    service.savePrice({
      productId: 10,
      branchId: 2,
      employeeId: 35,
      role: 'MANAGER',
      data: { costPrice: 100 },
    }),
    (error) => error.code === 'PRICE_MUTATION_FORBIDDEN'
      && error.detail?.forbiddenFields?.includes('costPrice'),
  )

  await assert.rejects(
    service.savePrice({
      productId: 10,
      branchId: 2,
      employeeId: 35,
      role: 'OWNER',
      data: { priceRetail: 0 },
    }),
    (error) => error.code === 'ZERO_PRICE_REQUIRES_EXPLICIT_POLICY',
  )

  const result = await service.savePrice({
    productId: 10,
    branchId: 2,
    employeeId: 35,
    role: 'OWNER',
    data: {
      costPrice: 100,
      retailPrice: 150,
      effectiveDate: '2026-08-02T00:00:00.000Z',
    },
  })

  assert.equal(calls.length, 1)
  assert.equal(result.productId, 10)
  assert.equal(result.branchId, 2)
  assert.equal(result.employeeId, 35)
  assert.equal(Number(result.payload.costPrice), 100)
  assert.equal(Number(result.payload.priceRetail), 150)

  console.log('product-pricing-service-authority.contract.test.js: PASS')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    Module._load = originalLoad
    delete require.cache[servicePath]
  })
