const test = require('node:test')
const assert = require('node:assert/strict')
const { buildProductTracePermissions } = require('./productTracePolicy')

test('legacy owner and manager preserve product trace financial visibility', () => {
  for (const employeeRole of ['OWNER', 'MANAGER']) {
    const permissions = buildProductTracePermissions({
      actor: { id: 1, role: 'EMPLOYEE', employeeRole },
      employeeProfile: { v2Role: employeeRole },
    })
    assert.equal(permissions.canViewTrace, true)
    assert.equal(permissions.canViewFinancials, true)
    assert.equal(permissions.canViewSupplier, true)
  }

  for (const employeeRole of ['CASHIER', 'TECHNICIAN']) {
    const permissions = buildProductTracePermissions({
      actor: { id: 2, role: 'EMPLOYEE', employeeRole },
      employeeProfile: { v2Role: employeeRole },
    })
    assert.equal(permissions.canViewTrace, true)
    assert.equal(permissions.canViewFinancials, false)
    assert.equal(permissions.canViewSupplier, false)
  }
})

test('migrated positions require explicit product trace financial capability', () => {
  const migratedEmpty = buildProductTracePermissions({
    actor: {
      id: 3,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [],
    },
    employeeProfile: { v2Role: 'OWNER' },
  })
  assert.equal(migratedEmpty.canViewTrace, true)
  assert.equal(migratedEmpty.canViewFinancials, false)

  const explicit = buildProductTracePermissions({
    actor: {
      id: 4,
      role: 'EMPLOYEE',
      employeeRole: 'CASHIER',
      positionCapabilities: ['product.trace.financial'],
    },
    employeeProfile: { v2Role: 'CASHIER' },
  })
  assert.equal(explicit.canViewFinancials, true)
  assert.equal(explicit.canViewSupplier, true)
})

test('platform admins retain product trace financial authority', () => {
  const permissions = buildProductTracePermissions({
    actor: { id: 5, role: 'ADMIN', positionCapabilities: [] },
    employeeProfile: null,
  })
  assert.equal(permissions.canViewTrace, true)
  assert.equal(permissions.canViewFinancials, true)
})

test('general product trace visibility remains authenticated rather than position-gated', () => {
  assert.equal(buildProductTracePermissions({ actor: { id: 6, role: 'CUSTOMER' }, employeeProfile: null }).canViewTrace, true)
  assert.equal(buildProductTracePermissions({ actor: {}, employeeProfile: null }).canViewTrace, false)
})
