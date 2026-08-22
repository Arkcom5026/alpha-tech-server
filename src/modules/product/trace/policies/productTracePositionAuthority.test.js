const test = require('node:test')
const assert = require('node:assert/strict')
const { buildProductTracePermissions } = require('./productTracePolicy')

test('product trace keeps authenticated read compatibility while financials stay elevated for legacy roles', () => {
  for (const v2Role of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const permissions = buildProductTracePermissions({
      actor: { id: 1, role: 'EMPLOYEE', employeeId: 7 },
      employeeProfile: { v2Role },
    })
    assert.equal(permissions.canViewTrace, true)
    assert.equal(permissions.canViewFinancials, ['OWNER', 'MANAGER'].includes(v2Role))
  }
})

test('migrated position explicitly controls product trace financial visibility', () => {
  assert.equal(buildProductTracePermissions({
    actor: { id: 1, role: 'EMPLOYEE', employeeId: 7, employeeRole: 'OWNER', positionCapabilities: [] },
    employeeProfile: { v2Role: 'OWNER' },
  }).canViewFinancials, false)

  assert.equal(buildProductTracePermissions({
    actor: {
      id: 1,
      role: 'EMPLOYEE',
      employeeId: 7,
      positionCapabilities: ['product.trace.financial.read'],
    },
    employeeProfile: { v2Role: 'CASHIER' },
  }).canViewFinancials, true)
})

test('platform admin retains product trace financial visibility', () => {
  const permissions = buildProductTracePermissions({
    actor: { id: 1, role: 'ADMIN', positionCapabilities: [] },
    employeeProfile: null,
  })
  assert.equal(permissions.canViewTrace, true)
  assert.equal(permissions.canViewFinancials, true)
})
