const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const routeSource = fs.readFileSync(
  path.join(__dirname, '../routes/supplierPaymentRoutes.js'),
  'utf8',
);

const readCapability = POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_PAYMENT_READ;

test('legacy employee roles preserve supplier payment read behavior while positions migrate', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    assert.equal(hasCapability({ role: 'EMPLOYEE', employeeRole }, readCapability), true);
  }
});

test('migrated positions require explicit supplier payment read capability', () => {
  assert.equal(hasCapability({ role: 'EMPLOYEE', positionCapabilities: [] }, readCapability), false);
  assert.equal(hasCapability({ role: 'EMPLOYEE', positionCapabilities: [readCapability] }, readCapability), true);
});

test('platform admin keeps supplier payment read authority', () => {
  assert.equal(hasCapability({ role: 'ADMIN', positionCapabilities: [] }, readCapability), true);
  assert.equal(hasCapability({ role: 'SUPERADMIN', positionCapabilities: [] }, readCapability), true);
});

test('supplier payment history reads are capability gated while financial mutations remain closed', () => {
  assert.match(routeSource, /router\.get\('\/advance', allowSupplierPaymentRead, getAdvancePaymentsBySupplier\)/);
  assert.match(routeSource, /router\.get\('\/by-supplier\/:supplierId', allowSupplierPaymentRead, getSupplierPaymentsBySupplier\)/);
  assert.match(routeSource, /router\.get\('\/', allowSupplierPaymentRead, getAllSupplierPayments\)/);
  assert.match(routeSource, /router\.get\('\/by-po\/:poId', allowSupplierPaymentRead, getSupplierPaymentsByPO\)/);
  assert.match(routeSource, /router\.post\('\/', requireSupplierPaymentActor,/);
  assert.match(routeSource, /SUPPLIER_PAYMENT_AUTHORITY_REQUIRED/);
  assert.match(routeSource, /router\.delete\('\/:id'/);
  assert.match(routeSource, /SUPPLIER_PAYMENT_REVERSAL_REQUIRED/);
});
