const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProductTracePermissions } = require('./productTracePolicy');

test('legacy owner and manager retain product trace financial visibility', () => {
  for (const v2Role of ['OWNER', 'MANAGER']) {
    const permissions = buildProductTracePermissions({
      actor: { id: 1, role: 'EMPLOYEE', employeeId: 8 },
      employeeProfile: { v2Role },
    });
    assert.equal(permissions.canViewTrace, true);
    assert.equal(permissions.canViewFinancials, true);
    assert.equal(permissions.canViewSupplier, true);
  }
});

test('legacy cashier and technician keep trace access without financial visibility', () => {
  for (const v2Role of ['CASHIER', 'TECHNICIAN']) {
    const permissions = buildProductTracePermissions({
      actor: { id: 1, role: 'EMPLOYEE', employeeId: 8 },
      employeeProfile: { v2Role },
    });
    assert.equal(permissions.canViewTrace, true);
    assert.equal(permissions.canViewFinancials, false);
  }
});

test('migrated positions require explicit product trace financial capability', () => {
  const denied = buildProductTracePermissions({
    actor: {
      id: 1,
      role: 'EMPLOYEE',
      employeeId: 8,
      employeeRole: 'OWNER',
      positionCapabilities: [],
    },
    employeeProfile: { v2Role: 'OWNER' },
  });
  assert.equal(denied.canViewTrace, true);
  assert.equal(denied.canViewFinancials, false);

  const allowed = buildProductTracePermissions({
    actor: {
      id: 1,
      role: 'EMPLOYEE',
      employeeId: 8,
      employeeRole: 'CASHIER',
      positionCapabilities: ['product.trace.financials'],
    },
    employeeProfile: { v2Role: 'CASHIER' },
  });
  assert.equal(allowed.canViewFinancials, true);
});

test('platform admins retain financial visibility regardless of position capabilities', () => {
  const permissions = buildProductTracePermissions({
    actor: { id: 1, role: 'ADMIN', positionCapabilities: [] },
    employeeProfile: null,
  });
  assert.equal(permissions.canViewTrace, true);
  assert.equal(permissions.canViewFinancials, true);
});
