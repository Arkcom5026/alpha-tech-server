'use strict'

const assert = require('assert')
const {
  POSITION_CAPABILITIES,
  REPAIR_CAPABILITIES,
  INVENTORY_CAPABILITIES,
  resolveActorCapabilities,
  hasCapability,
} = require('../src/modules/employee/authorization/employeePositionAuthority')

const EMPLOYEE_MANAGE = POSITION_CAPABILITIES.EMPLOYEE_MANAGE
const REPAIR_INTAKE = POSITION_CAPABILITIES.REPAIR_INTAKE
const REPAIR_WORKFLOW = POSITION_CAPABILITIES.REPAIR_WORKFLOW
const REPAIR_PARTS = POSITION_CAPABILITIES.REPAIR_PARTS
const REPAIR_CUSTOMER_OVERRIDE = POSITION_CAPABILITIES.REPAIR_CUSTOMER_OVERRIDE
const INVENTORY_ADJUST = POSITION_CAPABILITIES.INVENTORY_ADJUST
const INVENTORY_TRANSFER = POSITION_CAPABILITIES.INVENTORY_TRANSFER
const INVENTORY_AUDIT = POSITION_CAPABILITIES.INVENTORY_AUDIT
const INVENTORY_AUDIT_FINALIZE = POSITION_CAPABILITIES.INVENTORY_AUDIT_FINALIZE

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
  for (const capability of INVENTORY_CAPABILITIES) {
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
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'MANAGER', positionCapabilities: [] }, INVENTORY_ADJUST),
  false,
  'an explicitly migrated position must override legacy MANAGER inventory adjustment authority',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'MANAGER', positionCapabilities: [] }, INVENTORY_TRANSFER),
  false,
  'an explicitly migrated position must override legacy MANAGER inventory transfer authority',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'MANAGER', positionCapabilities: [] }, INVENTORY_AUDIT),
  false,
  'an explicitly migrated position must override legacy MANAGER stock audit authority',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'MANAGER', positionCapabilities: [] }, INVENTORY_AUDIT_FINALIZE),
  false,
  'an explicitly migrated position must override legacy MANAGER stock audit finalization authority',
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
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: null }, REPAIR_CUSTOMER_OVERRIDE),
  false,
  'legacy CASHIER must not gain customer ownership override authority',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: null }, INVENTORY_ADJUST),
  false,
  'legacy CASHIER must not gain inventory adjustment authority',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: null }, INVENTORY_TRANSFER),
  false,
  'legacy CASHIER must not gain inventory transfer authority',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: null }, INVENTORY_AUDIT),
  true,
  'legacy CASHIER must preserve existing stock audit access during migration',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: null }, INVENTORY_AUDIT_FINALIZE),
  true,
  'legacy CASHIER must preserve existing stock audit finalization during migration',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [REPAIR_WORKFLOW] }, REPAIR_WORKFLOW),
  true,
  'migrated position must be able to grant repair workflow independent of v2Role',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [REPAIR_CUSTOMER_OVERRIDE] }, REPAIR_CUSTOMER_OVERRIDE),
  true,
  'migrated position must be able to grant customer ownership override independent of v2Role',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [INVENTORY_ADJUST] }, INVENTORY_ADJUST),
  true,
  'migrated position must be able to grant inventory adjustment independent of v2Role',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [INVENTORY_TRANSFER] }, INVENTORY_TRANSFER),
  true,
  'migrated position must be able to grant inventory transfer independent of v2Role',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [INVENTORY_AUDIT] }, INVENTORY_AUDIT),
  true,
  'migrated position must be able to grant stock audit access independent of v2Role',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [INVENTORY_AUDIT_FINALIZE] }, INVENTORY_AUDIT),
  false,
  'stock audit finalization alone must not implicitly grant stock audit access',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [INVENTORY_AUDIT_FINALIZE] }, INVENTORY_AUDIT_FINALIZE),
  true,
  'migrated position can hold finalization capability independently while route guard still requires audit access',
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
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'TECHNICIAN', positionCapabilities: null }, INVENTORY_AUDIT),
  true,
  'legacy technician compatibility preserves existing stock audit access',
)
assert.equal(
  hasCapability({ role: 'ADMIN', employeeRole: 'CASHIER', positionCapabilities: [] }, REPAIR_WORKFLOW),
  true,
  'platform ADMIN authority remains intact during position migration',
)
assert.equal(
  hasCapability({ role: 'ADMIN', employeeRole: 'CASHIER', positionCapabilities: [] }, INVENTORY_ADJUST),
  true,
  'platform ADMIN keeps inventory adjustment authority during position migration',
)
assert.equal(
  hasCapability({ role: 'ADMIN', employeeRole: 'CASHIER', positionCapabilities: [] }, INVENTORY_TRANSFER),
  true,
  'platform ADMIN keeps inventory transfer authority during position migration',
)
assert.equal(
  hasCapability({ role: 'ADMIN', employeeRole: 'CASHIER', positionCapabilities: [] }, INVENTORY_AUDIT_FINALIZE),
  true,
  'platform ADMIN keeps stock audit finalization authority during position migration',
)
assert.equal(
  hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: null }, EMPLOYEE_MANAGE),
  false,
)

console.log('employee-position-first-authority.contract.test.js: PASS')
