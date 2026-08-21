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

test('legacy employee roles preserve existing inventory receive behavior while positions migrate', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const result = runGuard({
      role: 'EMPLOYEE',
      employeeRole,
      positionCapabilities: null,
    }, STOCK_ITEM_CAPABILITY.RECEIVE);

    assert.equal(result.nextCalls, 1);
    assert.equal(result.nextError, undefined, `${employeeRole} should preserve legacy receive access`);
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

test('platform admin remains authorized regardless of migrated position capability state', () => {
  const result = runGuard({
    role: 'ADMIN',
    employeeRole: 'CASHIER',
    positionCapabilities: [],
  }, STOCK_ITEM_CAPABILITY.RECEIVE);

  assert.equal(result.nextError, undefined);
});

test('stock item routes guard receive mutations without changing unrelated lifecycle and query routes', () => {
  const routes = fs.readFileSync(
    path.join(__dirname, '../routes/stockItemRoutes.js'),
    'utf8',
  );

  assert.match(routes, /router\.post\('\/', allowInventoryReceive, receiptSlices\.addStockItemFromReceipt\)/);
  assert.match(routes, /router\.post\('\/receive-sn', allowInventoryReceive, normalizeStockItemReceivePayload, receiveSlices\.receiveStockItem\)/);
  assert.match(routes, /router\.post\('\/receive', allowInventoryReceive, normalizeStockItemReceivePayload, receiveSlices\.receiveStockItem\)/);
  assert.match(routes, /router\.post\('\/receive-all-no-sn', allowInventoryReceive, receiveSlices\.receiveAllPendingNoSN\)/);
  assert.match(routes, /router\.patch\('\/update-sn\/:barcode', allowInventoryReceive, querySlices\.updateSerialNumber\)/);

  assert.match(routes, /router\.patch\('\/mark-sold', lifecycleSlices\.markStockItemsAsSold\)/);
  assert.match(routes, /router\.get\('\/search', querySlices\.searchStockItem\)/);
  assert.match(routes, /router\.get\('\/available', querySlices\.getAvailableStockItemsByProduct\)/);
});
