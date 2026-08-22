const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PRODUCT_TRACE_CAPABILITY,
  buildProductTracePermissions,
} = require('./productTracePolicy');

test('legacy product trace preserves broad read and owner-manager financial visibility', () => {
  const technician = buildProductTracePermissions({
    actor: { id: 10, role: 'EMPLOYEE', employeeRole: 'TECHNICIAN' },
    employeeProfile: { v2Role: 'TECHNICIAN' },
  });
  assert.equal(technician.canViewTrace, true);
  assert.equal(technician.canViewFinancials, false);
  assert.equal(technician.canViewSupplier, false);

  const manager = buildProductTracePermissions({
    actor: { id: 11, role: 'EMPLOYEE' },
    employeeProfile: { v2Role: 'MANAGER' },
  });
  assert.equal(manager.canViewTrace, true);
  assert.equal(manager.canViewFinancials, true);
  assert.equal(manager.canViewSupplier, true);
});

test('migrated product trace positions require explicit read and financial capabilities', () => {
  const readOnly = buildProductTracePermissions({
    actor: {
      id: 10,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [PRODUCT_TRACE_CAPABILITY.READ],
    },
    employeeProfile: { v2Role: 'OWNER' },
  });
  assert.equal(readOnly.canViewTrace, true);
  assert.equal(readOnly.canViewFinancials, false);

  const financial = buildProductTracePermissions({
    actor: {
      id: 10,
      role: 'EMPLOYEE',
      employeeRole: 'CASHIER',
      positionCapabilities: [
        PRODUCT_TRACE_CAPABILITY.READ,
        PRODUCT_TRACE_CAPABILITY.FINANCIAL,
      ],
    },
    employeeProfile: { v2Role: 'CASHIER' },
  });
  assert.equal(financial.canViewTrace, true);
  assert.equal(financial.canViewFinancials, true);

  const empty = buildProductTracePermissions({
    actor: {
      id: 10,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [],
    },
    employeeProfile: { v2Role: 'OWNER' },
  });
  assert.equal(empty.canViewTrace, false);
  assert.equal(empty.canViewFinancials, false);
});

test('platform admins retain complete product trace visibility', () => {
  const admin = buildProductTracePermissions({
    actor: { id: 1, role: 'ADMIN', positionCapabilities: [] },
    employeeProfile: null,
  });
  assert.equal(admin.canViewTrace, true);
  assert.equal(admin.canViewFinancials, true);
  assert.equal(admin.canViewSupplier, true);
});
