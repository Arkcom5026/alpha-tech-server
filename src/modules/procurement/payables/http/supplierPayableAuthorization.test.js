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
const {
  SUPPLIER_PAYABLE_CAPABILITY,
} = require('./supplierPayableAuthorization');

const READ = POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_PAYABLE_READ;
const MANAGE = POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_PAYABLE_MANAGE;
const CONTROL = POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_PAYABLE_CONTROL;

const routeSource = fs.readFileSync(path.join(__dirname, 'supplierPayableRoutes.js'), 'utf8');

test('legacy supplier payable authority preserves manager work and owner-only control', () => {
  const owner = legacyCapabilitiesForRole('OWNER');
  const manager = legacyCapabilitiesForRole('MANAGER');
  const cashier = legacyCapabilitiesForRole('CASHIER');
  const technician = legacyCapabilitiesForRole('TECHNICIAN');

  assert.ok(owner.includes(READ));
  assert.ok(owner.includes(MANAGE));
  assert.ok(owner.includes(CONTROL));

  assert.ok(manager.includes(READ));
  assert.ok(manager.includes(MANAGE));
  assert.ok(!manager.includes(CONTROL));

  assert.ok(!cashier.includes(READ));
  assert.ok(!cashier.includes(MANAGE));
  assert.ok(!cashier.includes(CONTROL));
  assert.ok(!technician.includes(READ));
  assert.ok(!technician.includes(MANAGE));
  assert.ok(!technician.includes(CONTROL));
});

test('migrated positions require explicit supplier payable capabilities', () => {
  const readOnly = { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [READ] };
  const manager = { role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [READ, MANAGE] };
  const controller = { role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [READ, MANAGE, CONTROL] };
  const empty = { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] };

  assert.equal(hasCapability(readOnly, READ), true);
  assert.equal(hasCapability(readOnly, MANAGE), false);
  assert.equal(hasCapability(readOnly, CONTROL), false);

  assert.equal(hasCapability(manager, READ), true);
  assert.equal(hasCapability(manager, MANAGE), true);
  assert.equal(hasCapability(manager, CONTROL), false);

  assert.equal(hasCapability(controller, CONTROL), true);
  assert.equal(hasCapability(empty, READ), false);
});

test('platform admins retain supplier payable authority', () => {
  const admin = { role: 'ADMIN', positionCapabilities: [] };
  const superAdmin = { role: 'SUPERADMIN', positionCapabilities: [] };

  for (const capability of Object.values(SUPPLIER_PAYABLE_CAPABILITY)) {
    assert.equal(hasCapability(admin, capability), true);
    assert.equal(hasCapability(superAdmin, capability), true);
  }
});

test('supplier payable routes split read, manage and elevated control authority', () => {
  assert.match(routeSource, /router\.get\('\/candidates', allowRead, controller\.listCandidates\)/);
  assert.match(routeSource, /router\.get\('\/aging', allowRead, agingController\.list\)/);
  assert.match(routeSource, /router\.get\('\/disputes', allowRead, disputeController\.list\)/);
  assert.match(routeSource, /router\.get\('\/', allowRead, controller\.list\)/);
  assert.match(routeSource, /router\.post\('\/from-receipts', allowManage, controller\.createFromReceipts\)/);
  assert.match(routeSource, /router\.post\('\/:payableId\/disputes', allowManage, disputeController\.open\)/);
  assert.match(routeSource, /router\.post\('\/:payableId\/adjustments', allowManage, disputeController\.createAdjustment\)/);
  assert.match(routeSource, /router\.post\('\/disputes\/:disputeId\/resolve', allowManage, disputeController\.resolve\)/);
  assert.match(routeSource, /router\.post\('\/adjustments\/:adjustmentId\/void', allowControl, disputeController\.voidAdjustment\)/);
  assert.doesNotMatch(routeSource, /OWNER|MANAGER|employeeRole|v2Role/);
});
