const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { buildProductTracePermissions } = require('./productTracePolicy')
const { POSITION_CAPABILITIES } = require('../../../employee/authorization/employeePositionAuthority')

test('legacy employees preserve trace access while financial projection remains elevated', () => {
  const technician = buildProductTracePermissions({
    actor: { id: 1, employeeId: 8, profileType: 'employee', role: 'EMPLOYEE', employeeRole: 'TECHNICIAN' },
  })
  assert.equal(technician.canViewTrace, true)
  assert.equal(technician.canViewFinancials, false)

  const manager = buildProductTracePermissions({
    actor: { id: 1, employeeId: 8, profileType: 'employee', role: 'EMPLOYEE', employeeRole: 'MANAGER' },
  })
  assert.equal(manager.canViewTrace, true)
  assert.equal(manager.canViewFinancials, true)
})

test('migrated positions require explicit trace and financial capabilities', () => {
  const readOnly = buildProductTracePermissions({
    actor: {
      id: 1,
      employeeId: 8,
      profileType: 'employee',
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [POSITION_CAPABILITIES.PRODUCT_TRACE_READ],
    },
  })
  assert.equal(readOnly.canViewTrace, true)
  assert.equal(readOnly.canViewFinancials, false)

  const financial = buildProductTracePermissions({
    actor: {
      id: 1,
      employeeId: 8,
      profileType: 'employee',
      role: 'EMPLOYEE',
      employeeRole: 'TECHNICIAN',
      positionCapabilities: [
        POSITION_CAPABILITIES.PRODUCT_TRACE_READ,
        POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIAL,
      ],
    },
  })
  assert.equal(financial.canViewTrace, true)
  assert.equal(financial.canViewFinancials, true)

  const empty = buildProductTracePermissions({
    actor: {
      id: 1,
      employeeId: 8,
      profileType: 'employee',
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [],
    },
  })
  assert.equal(empty.canViewTrace, false)
  assert.equal(empty.canViewFinancials, false)
})

test('platform admins retain trace and financial authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    const permissions = buildProductTracePermissions({
      actor: { id: 1, employeeId: 8, profileType: 'employee', role, positionCapabilities: [] },
    })
    assert.equal(permissions.canViewTrace, true)
    assert.equal(permissions.canViewFinancials, true)
  }
})

test('non-employee authenticated trace behavior stays compatible and service avoids duplicate employee lookup', () => {
  const customer = buildProductTracePermissions({ actor: { id: 1, role: 'CUSTOMER', profileType: 'customer' } })
  assert.equal(customer.canViewTrace, true)
  assert.equal(customer.canViewFinancials, false)

  const serviceSource = fs.readFileSync(path.resolve(__dirname, '../services/productTraceService.js'), 'utf8')
  assert.doesNotMatch(serviceSource, /findEmployeeAuthorizationContext/)
  assert.match(serviceSource, /buildProductTracePermissions\(\{ actor \}\)/)
})
