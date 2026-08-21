'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');
const {
  PURCHASE_ORDER_CAPABILITY,
  allowPurchaseOrderCapabilities,
} = require('./purchaseOrderAuthorization');

const ACCESS = POSITION_CAPABILITIES.PROCUREMENT_PURCHASE_ORDER;
const CONTROL = POSITION_CAPABILITIES.PROCUREMENT_PURCHASE_ORDER_CONTROL;

const runMiddleware = (actor, requiredCapabilities) => new Promise((resolve) => {
  const middleware = allowPurchaseOrderCapabilities(...requiredCapabilities);
  middleware({ user: actor }, {}, (error) => resolve(error || null));
});

test('legacy employee roles preserve purchase order behavior while positions migrate', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const actor = { role: 'EMPLOYEE', employeeRole, positionCapabilities: null };
    assert.equal(hasCapability(actor, ACCESS), true, `${employeeRole} must keep purchase order access`);
    assert.equal(hasCapability(actor, CONTROL), true, `${employeeRole} must keep purchase order control`);
  }
});

test('migrated positions require explicit access and control capabilities', async () => {
  const emptyPosition = { role: 'EMPLOYEE', employeeRole: 'MANAGER', positionCapabilities: [] };
  assert.equal(hasCapability(emptyPosition, ACCESS), false);
  assert.equal(hasCapability(emptyPosition, CONTROL), false);

  const accessOnly = { role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [ACCESS] };
  assert.equal(await runMiddleware(accessOnly, [PURCHASE_ORDER_CAPABILITY.ACCESS]), null);
  const denied = await runMiddleware(accessOnly, [PURCHASE_ORDER_CAPABILITY.ACCESS, PURCHASE_ORDER_CAPABILITY.CONTROL]);
  assert.equal(denied?.code, 'PURCHASE_ORDER_FORBIDDEN');
  assert.equal(denied?.statusCode, 403);

  const controlOnly = { role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [CONTROL] };
  const missingAccess = await runMiddleware(controlOnly, [PURCHASE_ORDER_CAPABILITY.ACCESS, PURCHASE_ORDER_CAPABILITY.CONTROL]);
  assert.equal(missingAccess?.code, 'PURCHASE_ORDER_FORBIDDEN');

  const full = { role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [ACCESS, CONTROL] };
  assert.equal(await runMiddleware(full, [PURCHASE_ORDER_CAPABILITY.ACCESS, PURCHASE_ORDER_CAPABILITY.CONTROL]), null);
});

test('platform admin keeps purchase order authority', async () => {
  const actor = { role: 'ADMIN', employeeRole: 'CASHIER', positionCapabilities: [] };
  assert.equal(hasCapability(actor, ACCESS), true);
  assert.equal(hasCapability(actor, CONTROL), true);
  assert.equal(await runMiddleware(actor, [ACCESS, CONTROL]), null);
});

test('purchase order routes separate normal work, control actions, and receipt discovery', () => {
  const routeSource = fs.readFileSync(
    path.join(__dirname, '../routes/purchaseOrderRoutes.js'),
    'utf8',
  );

  assert.match(routeSource, /router\.post\('\/', allowPurchaseOrderAccess, createPurchaseOrderController\.handle\)/);
  assert.match(routeSource, /router\.put\('\/:id', allowPurchaseOrderAccess, updatePurchaseOrderController\.handle\)/);
  assert.match(routeSource, /router\.delete\('\/:id', allowPurchaseOrderControl, deletePurchaseOrderController\.handle\)/);
  assert.match(routeSource, /router\.patch\('\/:id\/status', allowPurchaseOrderControl, updatePurchaseOrderStatusController\.handle\)/);
  assert.match(routeSource, /router\.get\('\/eligible-for-receipt', allowPurchaseReceiptAccess, listEligiblePurchaseOrdersController\.handle\)/);
  assert.match(routeSource, /router\.get\('\/:id\/detail-for-receipt', allowPurchaseReceiptAccess, getReceiptPurchaseOrderController\.handle\)/);
});
