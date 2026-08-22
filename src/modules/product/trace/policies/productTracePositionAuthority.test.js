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

test('migrated employee position explicitly controls product trace read and financial visibility', () => {
  const empty = buildProductTracePermissions({
    actor: { id: 1, role: 'EMPLOYEE', employeeId: 7, employeeRole: 'OWNER', positionCapabilities: [] },
    employeeProfile: { v2Role: 'OWNER' },
  })
  assert.equal(empty.canViewTrace, false)
  assert.equal(empty.canViewFinancials, false)

  const readOnly = buildProductTracePermissions({
    actor: {
      id: 1,
      role: 'EMPLOYEE',
      employeeId: 7,
      positionCapabilities: ['product.trace.read'],
    },
    employeeProfile: { v2Role: 'OWNER' },
  })
  assert.equal(readOnly.canViewTrace, true)
  assert.equal(readOnly.canViewFinancials, false)

  const financial = buildProductTracePermissions({
    actor: {
      id: 1,
      role: 'EMPLOYEE',
      employeeId: 7,
      positionCapabilities: ['product.trace.read', 'product.trace.financial.read'],
    },
    employeeProfile: { v2Role: 'CASHIER' },
  })
  assert.equal(financial.canViewTrace, true)
  assert.equal(financial.canViewFinancials, true)
})

test('non-employee authenticated trace behavior remains unchanged', () => {
  const permissions = buildProductTracePermissions({
    actor: { id: 99, role: 'CUSTOMER' },
    employeeProfile: null,
  })
  assert.equal(permissions.canViewTrace, true)
  assert.equal(permissions.canViewFinancials, false)
})

test('platform admin retains product trace authority', () => {
  const permissions = buildProductTracePermissions({
    actor: { id: 1, role: 'ADMIN', positionCapabilities: [] },
    employeeProfile: null,
  })
  assert.equal(permissions.canViewTrace, true)
  assert.equal(permissions.canViewFinancials, true)
})
