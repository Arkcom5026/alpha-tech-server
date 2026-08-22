const test = require('node:test')
const assert = require('node:assert/strict')
const { buildProductTracePermissions } = require('./productTracePolicy')

test('legacy employee keeps trace read while financials remain owner-manager only', () => {
  const technician = buildProductTracePermissions({
    actor: { id: 1, employeeId: 8, branchId: 2, profileType: 'employee', employeeRole: 'TECHNICIAN' },
    employeeProfile: { id: 8, v2Role: 'TECHNICIAN' },
  })
  assert.equal(technician.canViewTrace, true)
  assert.equal(technician.canViewFinancials, false)

  const manager = buildProductTracePermissions({
    actor: { id: 2, employeeId: 9, branchId: 2, profileType: 'employee', employeeRole: 'MANAGER' },
    employeeProfile: { id: 9, v2Role: 'MANAGER' },
  })
  assert.equal(manager.canViewTrace, true)
  assert.equal(manager.canViewFinancials, true)
})

test('migrated positions require explicit product trace capabilities', () => {
  const readOnly = buildProductTracePermissions({
    actor: {
      id: 2,
      employeeId: 9,
      branchId: 2,
      profileType: 'employee',
      employeeRole: 'OWNER',
      positionCapabilities: ['product.trace.read'],
    },
    employeeProfile: { id: 9, v2Role: 'OWNER' },
  })
  assert.equal(readOnly.canViewTrace, true)
  assert.equal(readOnly.canViewFinancials, false)

  const empty = buildProductTracePermissions({
    actor: {
      id: 2,
      employeeId: 9,
      branchId: 2,
      profileType: 'employee',
      employeeRole: 'OWNER',
      positionCapabilities: [],
    },
    employeeProfile: { id: 9, v2Role: 'OWNER' },
  })
  assert.equal(empty.canViewTrace, false)
  assert.equal(empty.canViewFinancials, false)
})

test('platform admin retains complete product trace authority', () => {
  const admin = buildProductTracePermissions({
    actor: { id: 3, branchId: 2, role: 'ADMIN', positionCapabilities: [] },
    employeeProfile: null,
  })
  assert.equal(admin.canViewTrace, true)
  assert.equal(admin.canViewFinancials, true)
})
