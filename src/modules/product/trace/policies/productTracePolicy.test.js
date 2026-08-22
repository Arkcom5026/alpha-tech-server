const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProductTracePermissions } = require('./productTracePolicy');
const {
  OPERATIONAL_POSITION_CAPABILITIES,
} = require('../../../employee/authorization/employeeOperationalPositionAuthority');

test('legacy product trace keeps broad employee read with owner-manager financial visibility', () => {
  const technician = buildProductTracePermissions({
    actor: { id: 1, employeeId: 10, role: 'EMPLOYEE' },
    employeeProfile: { v2Role: 'TECHNICIAN' },
  });
  assert.equal(technician.canViewTrace, true);
  assert.equal(technician.canViewFinancials, false);
  assert.equal(technician.canViewSupplier, false);

  const manager = buildProductTracePermissions({
    actor: { id: 1, employeeId: 11, role: 'EMPLOYEE' },
    employeeProfile: { v2Role: 'MANAGER' },
  });
  assert.equal(manager.canViewTrace, true);
  assert.equal(manager.canViewFinancials, true);
  assert.equal(manager.canViewSupplier, true);
});

test('migrated positions require explicit trace and financial capabilities', () => {
  const readOnly = buildProductTracePermissions({
    actor: {
      id: 1,
      employeeId: 11,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [OPERATIONAL_POSITION_CAPABILITIES.PRODUCT_TRACE_READ],
    },
    employeeProfile: { v2Role: 'OWNER' },
  });
  assert.equal(readOnly.canViewTrace, true);
  assert.equal(readOnly.canViewFinancials, false);

  const full = buildProductTracePermissions({
    actor: {
      id: 1,
      employeeId: 11,
      role: 'EMPLOYEE',
      positionCapabilities: [
        OPERATIONAL_POSITION_CAPABILITIES.PRODUCT_TRACE_READ,
        OPERATIONAL_POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIALS,
      ],
    },
    employeeProfile: { v2Role: 'CASHIER' },
  });
  assert.equal(full.canViewTrace, true);
  assert.equal(full.canViewFinancials, true);
});

test('explicit empty migrated position is authoritative for employee product trace', () => {
  const permissions = buildProductTracePermissions({
    actor: {
      id: 1,
      employeeId: 11,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [],
    },
    employeeProfile: { v2Role: 'OWNER' },
  });
  assert.equal(permissions.canViewTrace, false);
  assert.equal(permissions.canViewFinancials, false);
});

test('platform admin keeps product trace financial authority regardless of position state', () => {
  const permissions = buildProductTracePermissions({
    actor: { id: 1, role: 'ADMIN', positionCapabilities: [] },
    employeeProfile: null,
  });
  assert.equal(permissions.canViewTrace, true);
  assert.equal(permissions.canViewFinancials, true);
});

test('non-employee authenticated trace behavior remains compatible', () => {
  const permissions = buildProductTracePermissions({
    actor: { id: 55, role: 'CUSTOMER' },
    employeeProfile: null,
  });
  assert.equal(permissions.canViewTrace, true);
  assert.equal(permissions.canViewFinancials, false);
});
