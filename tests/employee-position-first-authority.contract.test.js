'use strict'

const assert = require('assert')
const {
  POSITION_CAPABILITIES,
  resolveActorCapabilities,
  hasCapability,
} = require('../src/modules/employee/authorization/employeePositionAuthority')

const EMPLOYEE_MANAGE = POSITION_CAPABILITIES.EMPLOYEE_MANAGE

assert.deepEqual(
  resolveActorCapabilities({ role: 'EMPLOYEE', employeeRole: 'MANAGER', positionCapabilities: null }),
  { mode: 'V2_ROLE_COMPAT', capabilities: [EMPLOYEE_MANAGE] },
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'MANAGER', positionCapabilities: [] }, EMPLOYEE_MANAGE),
  false,
  'an explicitly migrated position must override legacy MANAGER authority',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [EMPLOYEE_MANAGE] }, EMPLOYEE_MANAGE),
  true,
  'position capability must override legacy CASHIER compatibility role',
)
assert.equal(
  hasCapability({ role: 'ADMIN', employeeRole: 'CASHIER', positionCapabilities: [] }, EMPLOYEE_MANAGE),
  true,
  'platform ADMIN authority remains intact during migration',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: null }, EMPLOYEE_MANAGE),
  false,
)

console.log('employee-position-first-authority.contract.test.js: PASS')
