'use strict'

const assert = require('assert')
const policy = require('../src/modules/product/pricing/policies/effectivePricePolicy')

assert.deepEqual(
  policy.resolveEffectivePrice({
    row: { priceRetail: '150.00' },
    priceType: 'retail',
    context: { branchId: 2, productId: 10 },
  }),
  { price: 150, priceType: 'retail', field: 'priceRetail' },
)

assert.deepEqual(
  policy.resolveEffectivePrice({
    row: { priceWholesale: 125 },
    priceType: 'WHOLESALE',
  }),
  { price: 125, priceType: 'wholesale', field: 'priceWholesale' },
)

assert.throws(
  () => policy.resolveEffectivePrice({ row: null, priceType: 'retail', context: { branchId: 2, productId: 10 } }),
  (error) => error.code === 'ACTIVE_BRANCH_PRICE_NOT_FOUND'
    && error.status === 409
    && error.detail?.branchId === 2
    && error.detail?.productId === 10,
)

assert.throws(
  () => policy.resolveEffectivePrice({ row: { priceTechnician: null }, priceType: 'technician' }),
  (error) => error.code === 'PRICE_VALUE_MISSING'
    && error.detail?.field === 'priceTechnician',
)

assert.throws(
  () => policy.resolveEffectivePrice({ row: { priceRetail: 0 }, priceType: 'retail' }),
  (error) => error.code === 'PRICE_VALUE_NOT_EFFECTIVE'
    && error.detail?.field === 'priceRetail',
)

assert.throws(
  () => policy.resolveEffectivePrice({ row: { priceRetail: 100 }, priceType: 'member' }),
  (error) => error.code === 'UNSUPPORTED_PRICE_TYPE'
    && error.status === 400,
)

console.log('effective-price-resolution.contract.test.js: PASS')
