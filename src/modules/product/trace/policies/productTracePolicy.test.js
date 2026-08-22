const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProductTracePermissions } = require('./productTracePolicy');

test('legacy employee compatibility preserves product trace read and financial boundaries', () => {
  const technician = buildProductTracePermissions({
    actor: { id: 1, role: 'EMPLOYEE' },
    employeeProfile: { v2Role: 'TECHNICIAN' },
  });
  assert.equal(technician.canViewTrace, true);
  assert.equal(technician.canViewFinancials, false);

  const manager = buildProductTracePermissions({
    actor: { id: 1, role: 'EMPLOYEE' },
    employeeProfile: { v2Role: 'MANAGER' },
  });
  assert.equal(manager.canViewTrace, true);
  assert.equal(manager.canViewFinancials, true);
  assert.equal(manager.canViewSupplier, true);
});

test('migrated positions require explicit product trace capabilities', () => {
  const denied = buildProductTracePermissions({
    actor: {
      id: 1,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [],
    },
    employeeProfile: { v2Role: 'OWNER' },
  });
  assert.equal(denied.canViewTrace, false);
  assert.equal(denied.canViewFinancials, false);

  const financialViewer = buildProductTracePermissions({
    actor: {
      id: 1,
      role: 'EMPLOYEE',
      employeeRole: 'TECHNICIAN',
      positionCapabilities: ['product.trace.read', 'product.trace.financials'],
    },
    employeeProfile: { v2Role: 'TECHNICIAN' },
  });
  assert.equal(financialViewer.canViewTrace, true);
  assert.equal(financialViewer.canViewFinancials, true);
  assert.equal(financialViewer.canViewSupplier, true);
});

test('platform admins retain product trace authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    const permissions = buildProductTracePermissions({
      actor: { id: 1, role, positionCapabilities: [] },
      employeeProfile: null,
    });
    assert.equal(permissions.canViewTrace, true);
    assert.equal(permissions.canViewFinancials, true);
  }
});
