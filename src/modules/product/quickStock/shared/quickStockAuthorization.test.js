const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  QUICK_STOCK_CAPABILITY,
  allowQuickStockCapabilities,
} = require('./quickStockAuthorization');

const runGuard = (user, ...capabilities) => {
  let nextError;
  let nextCalls = 0;
  const guard = allowQuickStockCapabilities(...capabilities);
  guard({ user }, {}, (error) => {
    nextCalls += 1;
    nextError = error;
  });
  return { nextCalls, nextError };
};

test('legacy employee roles preserve quick stock mutation access while positions migrate', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const result = runGuard({
      role: 'EMPLOYEE',
      employeeRole,
      positionCapabilities: null,
    }, QUICK_STOCK_CAPABILITY.MUTATE);

    assert.equal(result.nextCalls, 1);
    assert.equal(result.nextError, undefined, `${employeeRole} should preserve legacy quick stock access`);
  }
});

test('migrated positions require explicit quick stock capability', () => {
  const denied = runGuard({
    role: 'EMPLOYEE',
    employeeRole: 'MANAGER',
    positionCapabilities: [],
  }, QUICK_STOCK_CAPABILITY.MUTATE);

  assert.equal(denied.nextCalls, 1);
  assert.equal(denied.nextError?.code, 'QUICK_STOCK_MUTATION_FORBIDDEN');
  assert.equal(denied.nextError?.statusCode, 403);

  const allowed = runGuard({
    role: 'EMPLOYEE',
    employeeRole: 'CASHIER',
    positionCapabilities: [QUICK_STOCK_CAPABILITY.MUTATE],
  }, QUICK_STOCK_CAPABILITY.MUTATE);

  assert.equal(allowed.nextError, undefined);
});

test('platform admin keeps quick stock mutation authority', () => {
  const result = runGuard({
    role: 'ADMIN',
    employeeRole: 'CASHIER',
    positionCapabilities: [],
  }, QUICK_STOCK_CAPABILITY.MUTATE);

  assert.equal(result.nextError, undefined);
});

test('one-shot quick stock mutations are gated while dropdowns and Quick Receipt remain separate', () => {
  const routes = fs.readFileSync(
    path.join(__dirname, '../routes/quickStockRoutes.js'),
    'utf8',
  );

  assert.match(routes, /router\.post\('\/quick-enroll', allowQuickStockMutation, handleQuickEnroll\)/);
  assert.match(routes, /router\.post\('\/all-in-one', allowQuickStockMutation, handleQuickStockInAllInOne\)/);
  assert.match(routes, /router\.post\('\/existing', allowQuickStockMutation, handleQuickStockExistingReceive\)/);
  assert.match(routes, /router\.get\('\/dropdowns', handleQuickReceiveDropdowns\)/);
  assert.match(routes, /router\.post\('\/receipts', quickReceiptSessionController\.create\)/);
  assert.match(routes, /router\.post\('\/receipts\/:id\/finalize', quickReceiptSessionController\.finalize\)/);
});
