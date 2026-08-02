'use strict'

const assert = require('assert')
const policy = require('../src/modules/product/pricing/policies/priceAuthorityPolicy')

const owner = { branchId: 2, employeeId: 35, role: 'OWNER' }
const manager = { branchId: 2, employeeId: 36, role: 'MANAGER' }

assert.doesNotThrow(() => policy.assertPricePayload({
  actor: owner,
  payload: { costPrice: 100, priceRetail: 150 },
}))

assert.doesNotThrow(() => policy.assertPricePayload({
  actor: manager,
  payload: { priceRetail: 150, priceOnline: 145 },
}))

assert.throws(
  () => policy.assertPricePayload({ actor: manager, payload: { costPrice: 100 } }),
  (error) => error.code === 'PRICE_MUTATION_FORBIDDEN'
    && error.status === 403
    && error.detail?.forbiddenFields?.includes('costPrice'),
)

assert.throws(
  () => policy.assertPricePayload({ actor: owner, payload: { priceRetail: 0 } }),
  (error) => error.code === 'ZERO_PRICE_REQUIRES_EXPLICIT_POLICY',
)

assert.throws(
  () => policy.assertPricePayload({ actor: owner, payload: { priceWholesale: -1 } }),
  (error) => error.code === 'NEGATIVE_PRICE_NOT_ALLOWED',
)

assert.throws(
  () => policy.assertPricePayload({
    actor: owner,
    payload: { priceRetail: 150 },
    effectiveDate: '2026-08-03T00:00:00.000Z',
    expiredDate: '2026-08-02T00:00:00.000Z',
  }),
  (error) => error.code === 'INVALID_PRICE_DATE_RANGE',
)

assert.throws(
  () => policy.assertPricePayload({
    actor: { employeeId: 35, role: 'OWNER' },
    payload: { priceRetail: 150 },
  }),
  (error) => error.code === 'PRICE_BRANCH_CONTEXT_REQUIRED',
)

console.log('price-authority-policy-foundation.contract.test.js: PASS')
