const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildProductTracePermissions,
  assertCanViewProductTrace,
} = require('./productTracePolicy');
const {
  RESIDUAL_BUSINESS_CAPABILITIES,
} = require('../../../employee/authorization/residualBusinessPositionAuthority');

test('legacy product trace keeps broad read access and elevated financial visibility', () => {
  const technician = buildProductTracePermissions({
    actor: { id: 1, employeeId: 10, role: 'EMPLOYEE', employeeRole: 'TECHNICIAN' },
    employeeProfile: { id: 10, v2Role: 'TECHNICIAN' },
  });
  assert.equal(technician.canViewTrace, true);
  assert.equal(technician.canViewFinancials, false);

  const manager = buildProductTracePermissions({
    actor: { id: 2, employeeId: 11, role: 'EMPLOYEE', employeeRole: 'MANAGER' },
    employeeProfile: { id: 11, v2Role: 'MANAGER' },
  });
  assert.equal(manager.canViewTrace, true);
  assert.equal(manager.canViewFinancials, true);
});

test('migrated positions split trace read from financial visibility', () => {
  const readOnly = buildProductTracePermissions({
    actor: {
      id: 3,
      employeeId: 12,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [RESIDUAL_BUSINESS_CAPABILITIES.PRODUCT_TRACE_READ],
    },
    employeeProfile: { id: 12, v2Role: 'OWNER' },
  });
  assert.equal(readOnly.canViewTrace, true);
  assert.equal(readOnly.canViewFinancials, false);

  const empty = buildProductTracePermissions({
    actor: {
      id: 4,
      employeeId: 13,
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [],
    },
    employeeProfile: { id: 13, v2Role: 'OWNER' },
  });
  assert.equal(empty.canViewTrace, false);
  assert.throws(() => assertCanViewProductTrace(empty), /ไม่มีสิทธิ์ดูประวัติสินค้า/);
});

test('platform admin retains trace and financial visibility', () => {
  const permissions = buildProductTracePermissions({
    actor: { id: 5, role: 'ADMIN', positionCapabilities: [] },
    employeeProfile: null,
  });
  assert.equal(permissions.canViewTrace, true);
  assert.equal(permissions.canViewFinancials, true);
});

test('non-employee compatibility keeps historical authenticated trace visibility without financial data', () => {
  const permissions = buildProductTracePermissions({
    actor: { id: 6, role: 'CUSTOMER' },
    employeeProfile: null,
  });
  assert.equal(permissions.canViewTrace, true);
  assert.equal(permissions.canViewFinancials, false);
});
