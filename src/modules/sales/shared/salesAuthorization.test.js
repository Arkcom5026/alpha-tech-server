const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  POSITION_CAPABILITIES,
  legacyCapabilitiesForRole,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const routeSource = fs.readFileSync(
  path.join(__dirname, '../routes/saleRoutes.js'),
  'utf8',
);

test('legacy employee roles preserve core sales behavior while positions migrate', () => {
  for (const role of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const capabilities = legacyCapabilitiesForRole(role);
    assert.ok(capabilities.includes(POSITION_CAPABILITIES.SALES_CORE), role);
    assert.ok(capabilities.includes(POSITION_CAPABILITIES.SALES_COMPLETE), role);
  }
});

test('migrated positions require explicit sales core and completion capabilities', () => {
  const empty = { positionCapabilities: [] };
  const coreOnly = { positionCapabilities: [POSITION_CAPABILITIES.SALES_CORE] };
  const completeOnly = { positionCapabilities: [POSITION_CAPABILITIES.SALES_COMPLETE] };
  const full = {
    positionCapabilities: [
      POSITION_CAPABILITIES.SALES_CORE,
      POSITION_CAPABILITIES.SALES_COMPLETE,
    ],
  };

  assert.equal(hasCapability(empty, POSITION_CAPABILITIES.SALES_CORE), false);
  assert.equal(hasCapability(coreOnly, POSITION_CAPABILITIES.SALES_CORE), true);
  assert.equal(hasCapability(coreOnly, POSITION_CAPABILITIES.SALES_COMPLETE), false);
  assert.equal(hasCapability(completeOnly, POSITION_CAPABILITIES.SALES_CORE), false);
  assert.equal(hasCapability(completeOnly, POSITION_CAPABILITIES.SALES_COMPLETE), true);
  assert.equal(hasCapability(full, POSITION_CAPABILITIES.SALES_CORE), true);
  assert.equal(hasCapability(full, POSITION_CAPABILITIES.SALES_COMPLETE), true);
});

test('platform admin keeps sales core authority', () => {
  const admin = { role: 'ADMIN', positionCapabilities: [] };
  const superAdmin = { role: 'SUPERADMIN', positionCapabilities: [] };

  for (const actor of [admin, superAdmin]) {
    assert.equal(hasCapability(actor, POSITION_CAPABILITIES.SALES_CORE), true);
    assert.equal(hasCapability(actor, POSITION_CAPABILITIES.SALES_COMPLETE), true);
  }
});

test('sales routes gate core work and completion without swallowing adjacent authorities', () => {
  assert.match(routeSource, /router\.use\('\/held-carts', allowSalesCore, posHeldCartRoutes\)/);
  assert.match(routeSource, /router\.get\('\/items\/search', allowSalesCore, searchSaleItemsController\)/);
  assert.match(routeSource, /router\.post\('\/complete', allowSalesCompletion, completeSaleController\)/);
  assert.match(routeSource, /router\.post\('\/', allowSalesCore, createSale\)/);
  assert.match(routeSource, /router\.get\('\/', allowSalesCore, getAllSales\)/);
  assert.match(routeSource, /router\.get\('\/:id', allowSalesCore, getSaleById\)/);

  assert.match(routeSource, /router\.use\('\/quotations', quotationRoutes\)/);
  assert.match(routeSource, /router\.use\('\/returns', saleReturnRoutes\)/);
  assert.match(routeSource, /router\.post\('\/:id\/mark-paid', markSaleAsPaid\)/);
  assert.doesNotMatch(routeSource, /router\.use\('\/quotations', allowSalesCore/);
  assert.doesNotMatch(routeSource, /router\.use\('\/returns', allowSalesCore/);
  assert.doesNotMatch(routeSource, /router\.post\('\/:id\/mark-paid', allowSalesCore/);
});
