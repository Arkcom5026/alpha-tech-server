'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildProductTracePermissions } = require('./productTracePolicy');
const { POSITION_CAPABILITIES } = require('../../../employee/authorization/employeePositionAuthority');

const FINANCIALS = POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIALS;

const permissions = (actor) => buildProductTracePermissions({ actor, employeeProfile: null });

test('legacy product trace financial disclosure remains OWNER and MANAGER only', () => {
  for (const employeeRole of ['OWNER', 'MANAGER']) {
    assert.equal(permissions({ id: 1, role: 'EMPLOYEE', employeeRole }).canViewFinancials, true);
  }
  for (const employeeRole of ['CASHIER', 'TECHNICIAN']) {
    assert.equal(permissions({ id: 1, role: 'EMPLOYEE', employeeRole }).canViewFinancials, false);
  }
});

test('migrated positions explicitly control product trace financial disclosure', () => {
  assert.equal(
    permissions({ id: 1, role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] }).canViewFinancials,
    false,
  );
  assert.equal(
    permissions({ id: 1, role: 'EMPLOYEE', employeeRole: 'TECHNICIAN', positionCapabilities: [FINANCIALS] }).canViewFinancials,
    true,
  );
});

test('platform admins retain product trace financial disclosure authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    assert.equal(permissions({ id: 1, role, positionCapabilities: [] }).canViewFinancials, true);
  }
});

test('trace visibility remains authentication-based and separate from financial disclosure', () => {
  assert.equal(permissions({ id: 1, role: 'CUSTOMER', positionCapabilities: [] }).canViewTrace, true);
  assert.equal(permissions({ role: 'CUSTOMER', positionCapabilities: [FINANCIALS] }).canViewTrace, false);
});
