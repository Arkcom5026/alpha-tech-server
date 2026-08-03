'use strict'

const assert = require('assert')
const Module = require('module')

const servicePath = require.resolve('../src/modules/product/templateSearch/services/templateProductSearchService')
const policyPath = require.resolve('../src/modules/product/pricing/policies/effectivePricePolicy')

const originalLoad = Module._load
const calls = []
Module._load = function load(request, parent, isMain) {
  if (parent?.filename === servicePath && request === '../../pricing/policies/effectivePricePolicy') {
    return {
      resolveEffectivePrice(input) {
        calls.push(input)
        const map = {
          retail: input.row.priceRetail,
          wholesale: input.row.priceWholesale,
          technician: input.row.priceTechnician,
          online: input.row.priceOnline,
        }
        const value = map[input.priceType]
        if (value === undefined || value === null) {
          const error = new Error('missing')
          error.code = 'PRICE_VALUE_MISSING'
          error.status = 409
          throw error
        }
        if (Number(value) <= 0) {
          const error = new Error('invalid')
          error.code = 'PRICE_VALUE_NOT_EFFECTIVE'
          error.status = 409
          throw error
        }
        return Number(value)
      },
    }
  }
  return originalLoad(request, parent, isMain)
}

delete require.cache[servicePath]
delete require.cache[policyPath]
const { TemplateProductSearchService } = require(servicePath)
Module._load = originalLoad

const repository = {
  async findTemplateBranchByCode() {
    return { id: 9, branchCode: 'TPL' }
  },
  async searchTemplateProducts() {
    return [{
      id: 44,
      name: 'Template Product',
      active: true,
      mode: 'STRUCTURED',
      branchPrice: [{
        costPrice: 100,
        priceRetail: 150,
        priceWholesale: 140,
        priceTechnician: 135,
        priceOnline: 145,
        isActive: true,
      }],
      productImages: [],
    }]
  },
}

;(async () => {
  const service = new TemplateProductSearchService(null, repository)
  const [item] = await service.searchTemplateProducts({})

  assert.strictEqual(item.priceRetail, 150)
  assert.strictEqual(item.priceWholesale, 140)
  assert.strictEqual(item.priceTechnician, 135)
  assert.strictEqual(item.priceOnline, 145)
  assert.strictEqual(item.hasPrice, true)
  assert.strictEqual(item.priceReady, true)
  assert.deepStrictEqual(item.missingPriceFields, [])
  assert.strictEqual(calls.length, 4)
  assert(calls.every((call) => call.branchId === 9 && call.productId === 44))

  repository.searchTemplateProducts = async () => [{ id: 45, name: 'Missing Price', branchPrice: [] }]
  const [missingPrice] = await service.searchTemplateProducts({})
  assert.strictEqual(missingPrice.costPrice, null)
  assert.strictEqual(missingPrice.priceRetail, null)
  assert.strictEqual(missingPrice.priceWholesale, null)
  assert.strictEqual(missingPrice.priceTechnician, null)
  assert.strictEqual(missingPrice.priceOnline, null)
  assert.strictEqual(missingPrice.hasPrice, false)
  assert.strictEqual(missingPrice.priceReady, false)
  assert.deepStrictEqual(missingPrice.missingPriceFields, [
    'costPrice',
    'priceRetail',
    'priceWholesale',
    'priceTechnician',
    'priceOnline',
  ])

  repository.searchTemplateProducts = async () => [{
    id: 46,
    name: 'Incomplete Price',
    branchPrice: [{
      costPrice: 100,
      priceRetail: 0,
      priceWholesale: 140,
      priceTechnician: null,
      priceOnline: 145,
      isActive: true,
    }],
  }]
  const [incompletePrice] = await service.searchTemplateProducts({})
  assert.strictEqual(incompletePrice.costPrice, 100)
  assert.strictEqual(incompletePrice.priceRetail, null)
  assert.strictEqual(incompletePrice.priceWholesale, 140)
  assert.strictEqual(incompletePrice.priceTechnician, null)
  assert.strictEqual(incompletePrice.priceOnline, 145)
  assert.strictEqual(incompletePrice.hasPrice, false)
  assert.strictEqual(incompletePrice.priceReady, false)
  assert.deepStrictEqual(incompletePrice.missingPriceFields, ['priceRetail', 'priceTechnician'])

  console.log('template-product-search-price-authority.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
