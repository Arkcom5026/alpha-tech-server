const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PRODUCT_TRACE_CAPABILITY,
  buildProductTracePermissions,
} = require('./productTracePolicy');

test('legacy authenticated employees preserve trace visibility and financial role split', () => {
  const technician = buildProductTracePermissions({
    actor: { id: 1, employeeId: 8, role: 'EMPLOYEE' },
    employeeProfile: { v2Role: 'TECHNICIAN' },
  });
  assert.equal(technician.canViewTrace, true);
  assert.equal(technician.canViewFinancials, false);

  const manager = buildProductTracePermissions({
    actor: { id: 2, employeeId: 9, role: 'EMPLOYEE' },
    employeeProfile: { v2Role: 'MANAGER' },
  });
  assert.equal(manager.canViewTrace, true);
  assert.equal(manager.canViewFinancials, true);
});

test('migrated positions require explicit trace capabilities and empty arrays are authoritative', () => {
  const readOnly = buildProductTracePermissions({
    actor: {
      id: 3,
      employeeId: 10,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [PRODUCT_TRACE_CAPABILITY.READ],
    },
    employeeProfile: { v2Role: 'OWNER' },
  });
  assert.equal(readOnly.canViewTrace, true);
  assert.equal(readOnly.canViewFinancials, false);

  const none = buildProductTracePermissions({
    actor: {
      id: 4,
      employeeId: 11,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [],
    },
    employeeProfile: { v2Role: 'OWNER' },
  });
  assert.equal(none.canViewTrace, false);
  assert.equal(none.canViewFinancials, false);
});

test('migrated positions may opt into trace financial visibility explicitly', () => {
  const permissions = buildProductTracePermissions({
    actor: {
      id: 5,
      employeeId: 12,
      role: 'EMPLOYEE',
      employeeRole: 'CASHIER',
      positionCapabilities: [
        PRODUCT_TRACE_CAPABILITY.READ,
        PRODUCT_TRACE_CAPABILITY.FINANCIAL,
      ],
    },
    employeeProfile: { v2Role: 'CASHIER' },
  });
  assert.equal(permissions.canViewTrace, true);
  assert.equal(permissions.canViewFinancials, true);
  assert.equal(permissions.canViewSupplier, true);
});

test('platform admin retains all product trace visibility', () => {
  const permissions = buildProductTracePermissions({
    actor: { id: 6, role: 'ADMIN', positionCapabilities: [] },
    employeeProfile: null,
  });
  assert.equal(permissions.canViewTrace, true);
  assert.equal(permissions.canViewFinancials, true);
});

test('legacy authenticated non-employee trace read fallback remains compatible', () => {
  const permissions = buildProductTracePermissions({
    actor: { id: 7, role: 'CUSTOMER' },
    employeeProfile: null,
  });
  assert.equal(permissions.canViewTrace, true);
  assert.equal(permissions.canViewFinancials, false);
});
