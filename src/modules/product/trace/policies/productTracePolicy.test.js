'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProductTracePermissions } = require('./productTracePolicy');

test('legacy product trace financial visibility preserves owner and manager boundary', () => {
  for (const v2Role of ['OWNER', 'MANAGER']) {
    const permissions = buildProductTracePermissions({
      actor: { id: 1, role: 'EMPLOYEE' },
      employeeProfile: { v2Role },
    });
    assert.equal(permissions.canViewTrace, true);
    assert.equal(permissions.canViewFinancials, true);
    assert.equal(permissions.canViewSupplier, true);
  }

  for (const v2Role of ['CASHIER', 'TECHNICIAN']) {
    const permissions = buildProductTracePermissions({
      actor: { id: 1, role: 'EMPLOYEE' },
      employeeProfile: { v2Role },
    });
    assert.equal(permissions.canViewTrace, true);
    assert.equal(permissions.canViewFinancials, false);
  }
});

test('migrated position explicitly controls product trace financial visibility', () => {
  const denied = buildProductTracePermissions({
    actor: {
      id: 1,
      role: 'EMPLOYEE',
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
      employeeRole: 'TECHNICIAN',
      positionCapabilities: ['product.trace.financials'],
    },
    employeeProfile: { v2Role: 'TECHNICIAN' },
  });
  assert.equal(allowed.canViewFinancials, true);
  assert.equal(allowed.canViewSupplier, true);
});

test('platform admins retain product trace financial visibility', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    const permissions = buildProductTracePermissions({
      actor: { id: 1, role, positionCapabilities: [] },
      employeeProfile: null,
    });
    assert.equal(permissions.canViewFinancials, true);
  }
});

test('product trace base visibility stays authenticated and is not narrowed to employee-only', () => {
  const customerLikeActor = buildProductTracePermissions({
    actor: { id: 55, role: 'CUSTOMER' },
    employeeProfile: null,
  });
  assert.equal(customerLikeActor.canViewTrace, true);
  assert.equal(customerLikeActor.canViewFinancials, false);
});
