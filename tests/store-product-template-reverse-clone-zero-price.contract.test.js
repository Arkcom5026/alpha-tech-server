const assert = require('node:assert/strict')

const priceAuthorityPolicy = require('../src/modules/product/pricing/policies/priceAuthorityPolicy')
const {
  assertReverseClonePriceSnapshot,
} = require('../src/modules/product/templateReverseClone/services/storeProductTemplateReverseCloneService')

const actor = {
  branchId: 2,
  employeeId: 3,
  role: 'OWNER',
  v2Role: 'OWNER',
}

const zeroSnapshot = {
  costPrice: 100,
  priceRetail: 150,
  priceWholesale: 0,
  priceTechnician: 0,
  priceOnline: 0,
}

assert.doesNotThrow(() =>
  assertReverseClonePriceSnapshot({
    actor,
    payload: zeroSnapshot,
    effectiveDate: null,
    expiredDate: null,
  })
)

assert.throws(
  () =>
    assertReverseClonePriceSnapshot({
      actor,
      payload: { ...zeroSnapshot, priceWholesale: -1 },
    }),
  (error) => error?.code === 'NEGATIVE_PRICE_NOT_ALLOWED'
)

assert.throws(
  () =>
    assertReverseClonePriceSnapshot({
      actor,
      payload: zeroSnapshot,
      effectiveDate: '2026-08-13',
      expiredDate: '2026-08-12',
    }),
  (error) => error?.code === 'INVALID_PRICE_DATE_RANGE'
)

// Global price-entry policy remains unchanged: zero still requires explicit policy.
assert.throws(
  () =>
    priceAuthorityPolicy.assertPricePayload({
      actor,
      payload: zeroSnapshot,
    }),
  (error) => error?.code === 'ZERO_PRICE_REQUIRES_EXPLICIT_POLICY'
)

console.log('Store Product Template Reverse Clone Zero Price Contract: PASS')
