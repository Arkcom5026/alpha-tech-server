'use strict'

const assert = require('assert')
const {
  canOverrideCustomerOwnership,
} = require('../src/modules/repair/create/createRepairJobService')

const payload = { allowCustomerOverride: true }

assert.equal(
  canOverrideCustomerOwnership({ role: 'MANAGER', repairCapabilities: [] }, payload),
  false,
  'legacy role metadata alone must not grant customer ownership override after position-first cutover',
)

assert.equal(
  canOverrideCustomerOwnership({
    role: 'CASHIER',
    repairCapabilities: ['repair.customer-override'],
  }, payload),
  true,
  'position-derived capability must grant customer ownership override independent of v2Role label',
)

assert.equal(
  canOverrideCustomerOwnership({
    role: 'MANAGER',
    repairCapabilities: ['repair.customer-override'],
  }, { allowCustomerOverride: false }),
  false,
  'override capability must still require the explicit request flag',
)

console.log('repair-position-customer-override-authority.contract.test.js: PASS')
