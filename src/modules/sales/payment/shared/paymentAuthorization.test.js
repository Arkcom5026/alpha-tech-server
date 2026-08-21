const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');
const {
  PAYMENT_CAPABILITY,
  allowPaymentCapabilities,
} = require('./paymentAuthorization');

const root = path.resolve(__dirname, '../../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const runGuard = (guard, user) => {
  let nextCalled = false;
  const response = { statusCode: null, body: null };
  const res = {
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(body) {
      response.body = body;
      return body;
    },
  };
  guard({ user }, res, () => { nextCalled = true; });
  return { nextCalled, response };
};

test('legacy employee roles preserve payment behavior while positions migrate', () => {
  for (const role of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const actor = { employeeRole: role };
    assert.equal(hasCapability(actor, POSITION_CAPABILITIES.SALES_PAYMENT_READ), true);
    assert.equal(hasCapability(actor, POSITION_CAPABILITIES.SALES_PAYMENT_MANAGE), true);
    assert.equal(hasCapability(actor, POSITION_CAPABILITIES.SALES_PAYMENT_CANCEL), true);
    assert.equal(hasCapability(actor, POSITION_CAPABILITIES.SALES_SETTLEMENT_CLOSE), true);
  }
});

test('migrated positions require explicit payment capabilities and cancellation requires manage plus cancel', () => {
  const empty = { positionCapabilities: [] };
  assert.equal(hasCapability(empty, POSITION_CAPABILITIES.SALES_PAYMENT_READ), false);
  assert.equal(hasCapability(empty, POSITION_CAPABILITIES.SALES_PAYMENT_MANAGE), false);
  assert.equal(hasCapability(empty, POSITION_CAPABILITIES.SALES_PAYMENT_CANCEL), false);

  const cancelOnly = { positionCapabilities: [POSITION_CAPABILITIES.SALES_PAYMENT_CANCEL] };
  const cancelGuard = allowPaymentCapabilities(PAYMENT_CAPABILITY.MANAGE, PAYMENT_CAPABILITY.CANCEL);
  assert.equal(runGuard(cancelGuard, cancelOnly).nextCalled, false);

  const fullCancel = {
    positionCapabilities: [
      POSITION_CAPABILITIES.SALES_PAYMENT_MANAGE,
      POSITION_CAPABILITIES.SALES_PAYMENT_CANCEL,
    ],
  };
  assert.equal(runGuard(cancelGuard, fullCancel).nextCalled, true);
});

test('platform admin keeps payment authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    const actor = { role };
    assert.equal(hasCapability(actor, POSITION_CAPABILITIES.SALES_PAYMENT_READ), true);
    assert.equal(hasCapability(actor, POSITION_CAPABILITIES.SALES_PAYMENT_MANAGE), true);
    assert.equal(hasCapability(actor, POSITION_CAPABILITIES.SALES_PAYMENT_CANCEL), true);
  }
});

test('payment routes separate read, create, and cancellation authority', () => {
  const routes = read('src/modules/sales/payment/routes/paymentRoutes.js');
  assert.match(routes, /router\.post\('\/', allowPaymentManage, createPayments\)/);
  assert.match(routes, /router\.get\('\/printable', allowPaymentRead, searchPrintablePayments\)/);
  assert.match(routes, /router\.post\('\/cancel', allowPaymentCancel, cancelPayment\)/);
  assert.match(routes, /PAYMENT_CAPABILITY\.MANAGE,\s*PAYMENT_CAPABILITY\.CANCEL/);
});
