'use strict'

const assert = require('assert')
const {
  POSITION_CAPABILITIES,
  REPAIR_CAPABILITIES,
  resolveActorCapabilities,
  hasCapability,
} = require('../src/modules/employee/authorization/employeePositionAuthority')

const EMPLOYEE_MANAGE = POSITION_CAPABILITIES.EMPLOYEE_MANAGE
const REPAIR_INTAKE = POSITION_CAPABILITIES.REPAIR_INTAKE
const REPAIR_WORKFLOW = POSITION_CAPABILITIES.REPAIR_WORKFLOW
const REPAIR_PARTS = POSITION_CAPABILITIES.REPAIR_PARTS

{
  const legacyManager = resolveActorCapabilities({
    role: 'EMPLOYEE',
    employeeRole: 'MANAGER',
    positionCapabilities: null,
  })
  assert.equal(legacyManager.mode, 'V2_ROLE_COMPAT')
  assert.equal(legacyManager.capabilities.includes(EMPLOYEE_MANAGE), true)
  for (const capability of REPAIR_CAPABILITIES) {
    assert.equal(
      legacyManager.capabilities.includes(capability),
      true,
      `legacy MANAGER must preserve ${capability} during migration`,
    )
  }
}

assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'MANAGER', positionCapabilities: [] }, EMPLOYEE_MANAGE),
  false,
  'an explicitly migrated position must override legacy MANAGER employee authority',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'MANAGER', positionCapabilities: [] }, REPAIR_WORKFLOW),
  false,
  'an explicitly migrated position must override legacy MANAGER repair authority',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [EMPLOYEE_MANAGE] }, EMPLOYEE_MANAGE),
  true,
  'position capability must override legacy CASHIER compatibility role',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: null }, REPAIR_INTAKE),
  true,
  'legacy CASHIER must keep repair intake compatibility',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: null }, REPAIR_WORKFLOW),
  false,
  'legacy CASHIER must not gain repair workflow authority',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [REPAIR_WORKFLOW] }, REPAIR_WORKFLOW),
  true,
  'migrated position must be able to grant repair workflow independent of v2Role',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'TECHNICIAN', positionCapabilities: null }, REPAIR_WORKFLOW),
  true,
  'legacy technician compatibility must keep repair workflow while residual callers are retired',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'TECHNICIAN', positionCapabilities: null }, REPAIR_PARTS),
  true,
  'legacy technician compatibility must keep repair parts authority',
)
assert.equal(
  hasCapability({ role: 'ADMIN', employeeRole: 'CASHIER', positionCapabilities: [] }, REPAIR_WORKFLOW),
  true,
  'platform ADMIN authority remains intact during position migration',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: null }, EMPLOYEE_MANAGE),
  false,
)

console.log('employee-position-first-authority.contract.test.js: PASS')
