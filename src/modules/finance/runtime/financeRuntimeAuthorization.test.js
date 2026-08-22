'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  POSITION_CAPABILITIES,
  legacyCapabilitiesForRole,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');
const { FINANCE_RUNTIME_CAPABILITY } = require('./financeRuntimeAuthorization');

const READ = POSITION_CAPABILITIES.FINANCE_RECEIVABLES_READ;
const routeSource = fs.readFileSync(path.join(__dirname, '../routes/financeRuntimeRoutes.js'), 'utf8');

test('legacy employee roles preserve historical authenticated-only receivables access', () => {
  for (const role of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    assert.ok(legacyCapabilitiesForRole(role).includes(READ), `${role} should retain receivables read compatibility`);
  }
});

test('migrated positions require explicit finance receivables read capability', () => {
  const allowed = { role: 'EMPLOYEE', employeeRole: 'TECHNICIAN', positionCapabilities: [READ] };
  const denied = { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] };

  assert.equal(hasCapability(allowed, READ), true);
  assert.equal(hasCapability(denied, READ), false);
});

test('platform admins retain finance receivables read authority', () => {
  for (const actor of [
    { role: 'ADMIN', positionCapabilities: [] },
    { role: 'SUPERADMIN', positionCapabilities: [] },
  ]) {
    assert.equal(hasCapability(actor, FINANCE_RUNTIME_CAPABILITY.RECEIVABLES_READ), true);
  }
});

test('finance runtime gates receivables and customer-credit reads while leaving ping diagnostic authenticated-only', () => {
  assert.match(routeSource, /router\.get\('\/ar\/summary', allowReceivablesRead, financeRuntimeController\.getAccountsReceivableSummary\)/);
  assert.match(routeSource, /router\.get\('\/ar', allowReceivablesRead, financeRuntimeController\.getAccountsReceivableRows\)/);
  assert.match(routeSource, /router\.get\('\/customer-credit\/summary', allowReceivablesRead, financeRuntimeController\.getCustomerCreditSummary\)/);
  assert.match(routeSource, /router\.get\('\/customer-credit', allowReceivablesRead, financeRuntimeController\.getCustomerCreditRows\)/);
  assert.match(routeSource, /router\.get\('\/customer-credit\/:customerId', allowReceivablesRead, financeRuntimeController\.getCustomerCreditByCustomerId\)/);
  assert.match(routeSource, /router\.get\('\/ping', financeRuntimeController\.pingFinance\)/);
  assert.doesNotMatch(routeSource, /OWNER|MANAGER|CASHIER|TECHNICIAN|employeeRole|v2Role/);
});
