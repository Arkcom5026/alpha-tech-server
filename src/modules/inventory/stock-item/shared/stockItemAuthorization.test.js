const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  STOCK_ITEM_CAPABILITY,
  allowStockItemCapabilities,
} = require('./stockItemAuthorization');

const runGuard = (user, ...capabilities) => {
  let nextError;
  let nextCalls = 0;
  const guard = allowStockItemCapabilities(...capabilities);
  guard({ user }, {}, (error) => {
    nextCalls += 1;
    nextError = error;
  });
  return { nextCalls, nextError };
};

test('legacy employee roles preserve existing inventory receive and lifecycle behavior while positions migrate', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    for (const capability of [STOCK_ITEM_CAPABILITY.RECEIVE, STOCK_ITEM_CAPABILITY.LIFECYCLE]) {
      const result = runGuard({
        role: 'EMPLOYEE',
        employeeRole,
        positionCapabilities: null,
      }, capability);

      assert.equal(result.nextCalls, 1);
      assert.equal(result.nextError, undefined, `${employeeRole} should preserve legacy ${capability} access`);
    }
  }
});

test('migrated positions require explicit inventory receive capability', () => {
  const denied = runGuard({
    role: 'EMPLOYEE',
    employeeRole: 'MANAGER',
    positionCapabilities: [],
  }, STOCK_ITEM_CAPABILITY.RECEIVE);

  assert.equal(denied.nextCalls, 1);
  assert.equal(denied.nextError?.code, 'STOCK_ITEM_RECEIVE_FORBIDDEN');
  assert.equal(denied.nextError?.statusCode, 403);

  const allowed = runGuard({
    role: 'EMPLOYEE',
    employeeRole: 'CASHIER',
    positionCapabilities: [STOCK_ITEM_CAPABILITY.RECEIVE],
  }, STOCK_ITEM_CAPABILITY.RECEIVE);

  assert.equal(allowed.nextError, undefined);
});

test('migrated positions require explicit inventory lifecycle capability', () => {
  const denied = runGuard({
    role: 'EMPLOYEE',
    employeeRole: 'MANAGER',
    positionCapabilities: [],
  }, STOCK_ITEM_CAPABILITY.LIFECYCLE);

  assert.equal(denied.nextCalls, 1);
  assert.equal(denied.nextError?.code, 'STOCK_ITEM_LIFECYCLE_FORBIDDEN');
  assert.equal(denied.nextError?.statusCode, 403);

  const allowed = runGuard({
    role: 'EMPLOYEE',
    employeeRole: 'CASHIER',
    positionCapabilities: [STOCK_ITEM_CAPABILITY.LIFECYCLE],
  }, STOCK_ITEM_CAPABILITY.LIFECYCLE);

  assert.equal(allowed.nextError, undefined);

  const receiveOnly = runGuard({
    role: 'EMPLOYEE',
    employeeRole: 'CASHIER',
    positionCapabilities: [STOCK_ITEM_CAPABILITY.RECEIVE],
  }, STOCK_ITEM_CAPABILITY.LIFECYCLE);
  assert.equal(receiveOnly.nextError?.code, 'STOCK_ITEM_LIFECYCLE_FORBIDDEN');
});

test('platform admin remains authorized regardless of migrated position capability state', () => {
  for (const capability of [STOCK_ITEM_CAPABILITY.RECEIVE, STOCK_ITEM_CAPABILITY.LIFECYCLE]) {
    const result = runGuard({
      role: 'ADMIN',
      employeeRole: 'CASHIER',
      positionCapabilities: [],
    }, capability);

    assert.equal(result.nextError, undefined);
  }
});

test('stock item routes keep inventory authority separate while mark-sold follows sales completion authority', () => {
  const routes = fs.readFileSync(
    path.join(__dirname, '../routes/stockItemRoutes.js'),
    'utf8',
  );

  assert.match(routes, /router\.post\('\/', allowInventoryReceive, receiptSlices\.addStockItemFromReceipt\)/);
  assert.match(routes, /router\.post\('\/receive-sn', allowInventoryReceive, normalizeStockItemReceivePayload, receiveSlices\.receiveStockItem\)/);
  assert.match(routes, /router\.post\('\/receive', allowInventoryReceive, normalizeStockItemReceivePayload, receiveSlices\.receiveStockItem\)/);
  assert.match(routes, /router\.post\('\/receive-all-no-sn', allowInventoryReceive, receiveSlices\.receiveAllPendingNoSN\)/);
  assert.match(routes, /router\.patch\('\/update-sn\/:barcode', allowInventoryReceive, querySlices\.updateSerialNumber\)/);

  assert.match(routes, /router\.delete\('\/:id', allowInventoryLifecycle, lifecycleSlices\.deleteStockItem\)/);
  assert.match(routes, /router\.patch\('\/:id\/status', allowInventoryLifecycle, lifecycleSlices\.updateStockItemStatus\)/);

  assert.match(routes, /SALES_CAPABILITY\.CORE/);
  assert.match(routes, /SALES_CAPABILITY\.COMPLETE/);
  assert.match(routes, /router\.patch\('\/mark-sold', allowSalesCompletion, lifecycleSlices\.markStockItemsAsSold\)/);
  assert.doesNotMatch(routes, /router\.patch\('\/mark-sold', allowInventoryLifecycle/);
  assert.match(routes, /router\.get\('\/search', querySlices\.searchStockItem\)/);
  assert.match(routes, /router\.get\('\/available', querySlices\.getAvailableStockItemsByProduct\)/);
});
