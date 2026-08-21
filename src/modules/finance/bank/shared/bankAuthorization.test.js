'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  POSITION_CAPABILITIES,
  legacyCapabilitiesForRole,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');
const { BANK_CAPABILITY } = require('./bankAuthorization');

const READ = POSITION_CAPABILITIES.FINANCE_BANK_READ;
const MANAGE = POSITION_CAPABILITIES.FINANCE_BANK_MANAGE;
const DELETE = POSITION_CAPABILITIES.FINANCE_BANK_DELETE;
const routeSource = fs.readFileSync(path.join(__dirname, '../routes/bankRoutes.js'), 'utf8');

test('legacy employee roles preserve historical authenticated-only bank access while positions migrate', () => {
  for (const role of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const capabilities = legacyCapabilitiesForRole(role);
    assert.ok(capabilities.includes(READ), `${role} should retain bank read compatibility`);
    assert.ok(capabilities.includes(MANAGE), `${role} should retain bank manage compatibility`);
    assert.ok(capabilities.includes(DELETE), `${role} should retain bank delete compatibility`);
  }
});

test('migrated positions require explicit bank capabilities', () => {
  const readOnly = { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [READ] };
  const manager = { role: 'EMPLOYEE', employeeRole: 'TECHNICIAN', positionCapabilities: [READ, MANAGE] };
  const deleter = { role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [READ, MANAGE, DELETE] };
  const empty = { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] };

  assert.equal(hasCapability(readOnly, READ), true);
  assert.equal(hasCapability(readOnly, MANAGE), false);
  assert.equal(hasCapability(readOnly, DELETE), false);

  assert.equal(hasCapability(manager, READ), true);
  assert.equal(hasCapability(manager, MANAGE), true);
  assert.equal(hasCapability(manager, DELETE), false);

  assert.equal(hasCapability(deleter, DELETE), true);
  assert.equal(hasCapability(empty, READ), false);
});

test('platform admins retain bank authority', () => {
  const admin = { role: 'ADMIN', positionCapabilities: [] };
  const superAdmin = { role: 'SUPERADMIN', positionCapabilities: [] };

  for (const capability of Object.values(BANK_CAPABILITY)) {
    assert.equal(hasCapability(admin, capability), true);
    assert.equal(hasCapability(superAdmin, capability), true);
  }
});

test('bank routes split read, manage and destructive delete authority', () => {
  assert.match(routeSource, /router\.get\('\/', requireBankRead, getAllBanks\)/);
  assert.match(routeSource, /router\.get\('\/:id', requireBankRead, getBankById\)/);
  assert.match(routeSource, /router\.post\('\/', requireBankManage, createBank\)/);
  assert.match(routeSource, /router\.patch\('\/:id', requireBankManage, updateBank\)/);
  assert.match(routeSource, /router\.delete\('\/:id', requireBankDelete, deleteBank\)/);
  assert.doesNotMatch(routeSource, /OWNER|MANAGER|CASHIER|TECHNICIAN|employeeRole|v2Role/);
});
