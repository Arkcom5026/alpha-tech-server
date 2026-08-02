'use strict'

const assert = require('assert')
const Module = require('module')

const servicePath = '../src/modules/product/pricing/services/productPricingService'
const repoPath = require.resolve('../src/modules/product/pricing/repositories/productPricingRepository')

const calls = []
const repoStub = {
  toInt: (value) => {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : null
  },
  listProductPrices: async () => [],
  upsertBranchPrice: async () => ({}),
  findProductPrice: async (input) => {
    calls.push({ name: 'find', input })
    return input.branchId === 2 ? { id: input.priceId, productId: input.productId, branchId: 2 } : null
  },
  deleteProductPrice: async (input) => {
    calls.push({ name: 'delete', input })
    return { count: 1 }
  },
}

const originalLoad = Module._load
Module._load = function load(request, parent, isMain) {
  if (request === repoPath || request.endsWith('/repositories/productPricingRepository')) return repoStub
  return originalLoad.call(this, request, parent, isMain)
}

delete require.cache[require.resolve(servicePath)]
const service = require(servicePath)
Module._load = originalLoad

const owner = { actor: { branchId: 2, employeeId: 35, role: 'OWNER' } }
const manager = { actor: { branchId: 2, employeeId: 36, role: 'MANAGER' } }

;(async () => {
  await assert.rejects(
    () => service.removePrice({ productId: 10, priceId: 20, ...manager }),
    (error) => error.code === 'PRICE_DELETE_FORBIDDEN' && error.status === 403,
  )
  assert.equal(calls.length, 0)

  const result = await service.removePrice({ productId: 10, priceId: 20, ...owner })
  assert.equal(result.success, true)
  assert.deepEqual(calls, [
    { name: 'find', input: { productId: 10, priceId: 20, branchId: 2 } },
    { name: 'delete', input: { productId: 10, priceId: 20, branchId: 2 } },
  ])

  console.log('product-pricing-delete-authority.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
