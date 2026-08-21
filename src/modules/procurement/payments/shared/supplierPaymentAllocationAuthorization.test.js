'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const MANAGE = POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_PAYMENT_MANAGE;
const VOID = POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_PAYMENT_VOID;

const actor = (overrides = {}) => ({
  role: 'EMPLOYEE',
  employeeRole: 'CASHIER',
  positionCapabilities: null,
  ...overrides,
});

test('legacy supplier payment financial authority preserves OWNER and MANAGER boundaries', () => {
  assert.equal(hasCapability(actor({ employeeRole: 'OWNER' }), MANAGE), true);
  assert.equal(hasCapability(actor({ employeeRole: 'OWNER' }), VOID), true);
  assert.equal(hasCapability(actor({ employeeRole: 'MANAGER' }), MANAGE), true);
  assert.equal(hasCapability(actor({ employeeRole: 'MANAGER' }), VOID), false);
  assert.equal(hasCapability(actor({ employeeRole: 'CASHIER' }), MANAGE), false);
  assert.equal(hasCapability(actor({ employeeRole: 'TECHNICIAN' }), MANAGE), false);
});

test('migrated positions require explicit supplier payment manage and void capabilities', () => {
  const manageOnly = actor({ employeeRole: 'OWNER', positionCapabilities: [MANAGE] });
  assert.equal(hasCapability(manageOnly, MANAGE), true);
  assert.equal(hasCapability(manageOnly, VOID), false);

  const voidOnly = actor({ employeeRole: 'OWNER', positionCapabilities: [VOID] });
  assert.equal(hasCapability(voidOnly, MANAGE), false);
  assert.equal(hasCapability(voidOnly, VOID), true);

  const both = actor({ positionCapabilities: [MANAGE, VOID] });
  assert.equal(hasCapability(both, MANAGE), true);
  assert.equal(hasCapability(both, VOID), true);
});

test('platform admin keeps supplier payment financial authority', () => {
  assert.equal(hasCapability({ role: 'ADMIN', positionCapabilities: [] }, MANAGE), true);
  assert.equal(hasCapability({ role: 'ADMIN', positionCapabilities: [] }, VOID), true);
  assert.equal(hasCapability({ role: 'SUPERADMIN', positionCapabilities: [] }, VOID), true);
});

test('supplier payment allocation routes use centralized capability guards', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../http/supplierPaymentAllocationRoutes.js'),
    'utf8',
  );
  assert.match(source, /router\.use\(requireSupplierPaymentManage\)/);
  assert.match(source, /requireSupplierPaymentVoid/);
  assert.doesNotMatch(source, /OWNER.*MANAGER/);
  assert.doesNotMatch(source, /const roles/);
});
