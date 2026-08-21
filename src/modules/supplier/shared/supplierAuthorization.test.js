'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const root = path.resolve(__dirname, '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('legacy employee roles preserve supplier master-data behavior while positions migrate', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const actor = { role: 'EMPLOYEE', employeeRole, positionCapabilities: null };
    assert.equal(hasCapability(actor, POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER), true);
    assert.equal(hasCapability(actor, POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_DELETE), true);
  }
});

test('migrated positions require explicit supplier access and delete capabilities', () => {
  const empty = { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] };
  assert.equal(hasCapability(empty, POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER), false);
  assert.equal(hasCapability(empty, POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_DELETE), false);

  const accessOnly = {
    role: 'EMPLOYEE',
    employeeRole: 'CASHIER',
    positionCapabilities: [POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER],
  };
  assert.equal(hasCapability(accessOnly, POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER), true);
  assert.equal(hasCapability(accessOnly, POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_DELETE), false);

  const deleteOnly = {
    role: 'EMPLOYEE',
    employeeRole: 'OWNER',
    positionCapabilities: [POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_DELETE],
  };
  assert.equal(hasCapability(deleteOnly, POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER), false);
  assert.equal(hasCapability(deleteOnly, POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_DELETE), true);
});

test('platform admin keeps supplier master-data authority', () => {
  const actor = { role: 'ADMIN', positionCapabilities: [] };
  assert.equal(hasCapability(actor, POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER), true);
  assert.equal(hasCapability(actor, POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_DELETE), true);
});

test('supplier routes separate normal master-data work from destructive deletion', () => {
  const routes = read('src/modules/supplier/routes/supplierRoutes.js');
  assert.match(routes, /router\.post\('\/', allowSupplierAccess,/);
  assert.match(routes, /router\.get\('\/', allowSupplierAccess,/);
  assert.match(routes, /router\.get\('\/:id', allowSupplierAccess,/);
  assert.match(routes, /router\.put\('\/:id', allowSupplierAccess,/);
  assert.match(routes, /router\.delete\('\/:id', allowSupplierDelete,/);

  const authorization = read('src/modules/supplier/shared/supplierAuthorization.js');
  assert.match(authorization, /SUPPLIER_CAPABILITY\.ACCESS/);
  assert.match(authorization, /SUPPLIER_CAPABILITY\.DELETE/);
  assert.match(authorization, /SUPPLIER_FORBIDDEN/);
});
