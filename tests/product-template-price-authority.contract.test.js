'use strict'

const assert = require('assert')
const Module = require('module')

const servicePath = require.resolve('../src/modules/productTemplate/runtime/productTemplateRuntimeService')
const policyPath = require.resolve('../src/modules/product/pricing/policies/priceAuthorityPolicy')
const repositoryPath = require.resolve('../src/modules/productTemplate/runtime/productTemplateRuntimeRepository')

const originalLoad = Module._load
let persisted

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === './productTemplateRuntimeRepository' && parent?.filename === servicePath) {
    return {
      DEFAULT_TEMPLATE_BRANCH_CODE: 'TPL',
      findTemplateBranchByCode: async () => ({ id: 99, branchCode: 'TPL' }),
      findPriceSnapshot: async () => null,
      upsertPriceSnapshot: async (input) => {
        persisted = input
        return input
      },
    }
  }
  if (request === '../../product/pricing/policies/priceAuthorityPolicy' && parent?.filename === servicePath) {
    return require(policyPath)
  }
  return originalLoad(request, parent, isMain)
}

delete require.cache[servicePath]
delete require.cache[repositoryPath]
const service = require(servicePath)

async function main() {
  await assert.rejects(
    () => service.syncTemplatePriceSnapshot(10, 99, { costPrice: 0 }, {
      employeeId: 7,
      role: 'OWNER',
    }),
    (error) => error.code === 'ZERO_PRICE_REQUIRES_EXPLICIT_POLICY',
  )

  await assert.rejects(
    () => service.syncTemplatePriceSnapshot(10, 99, { costPrice: 100 }, {
      employeeId: 7,
      role: 'MANAGER',
    }),
    (error) => error.code === 'PRICE_MUTATION_FORBIDDEN',
  )

  await service.syncTemplatePriceSnapshot(10, 99, {
    costPrice: 100,
    priceRetail: 150,
  }, {
    employeeId: 7,
    role: 'OWNER',
  })

  assert.equal(persisted.branchId, 99)
  assert.equal(persisted.create.updatedBy, 7)
  assert.equal(persisted.update.updatedBy, 7)
  assert.equal(persisted.create.costPrice, 100)
  assert.equal(persisted.create.priceRetail, 150)

  console.log('product-template-price-authority.contract.test.js: PASS')
}

main()
  .finally(() => {
    Module._load = originalLoad
    delete require.cache[servicePath]
  })
