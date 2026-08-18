'use strict'

const assert = require('assert')
const service = require('../src/modules/product/readyToSell/services/readyToSellService')

const validPrice = {
  priceRetail: 150,
  priceWholesale: 140,
  priceTechnician: 130,
  priceOnline: 145,
}

assert.deepStrictEqual(
  service.resolvePrices(validPrice, { branchId: 2, productId: 10 }),
  {
    retail: { price: 150, priceType: 'retail', field: 'priceRetail' },
    wholesale: { price: 140, priceType: 'wholesale', field: 'priceWholesale' },
    technician: { price: 130, priceType: 'technician', field: 'priceTechnician' },
    online: { price: 145, priceType: 'online', field: 'priceOnline' },
  },
)

assert.throws(
  () => service.resolvePrices(null, { branchId: 2, productId: 10 }),
  (error) => error.code === 'ACTIVE_BRANCH_PRICE_NOT_FOUND'
    && error.status === 409
    && error.detail?.branchId === 2
    && error.detail?.productId === 10,
)

assert.throws(
  () => service.resolvePrices({ ...validPrice, priceRetail: 0 }, { branchId: 2, productId: 10 }),
  (error) => error.code === 'PRICE_VALUE_NOT_EFFECTIVE',
)

assert.throws(
  () => service.resolvePrices({ ...validPrice, priceWholesale: null }, { branchId: 2, productId: 10 }),
  (error) => error.code === 'PRICE_VALUE_MISSING',
)

console.log('ready-to-sell-price-authority.contract.test.js: PASS')
