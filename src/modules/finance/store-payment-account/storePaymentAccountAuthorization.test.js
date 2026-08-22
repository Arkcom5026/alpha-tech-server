'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  POSITION_CAPABILITIES,
} = require('../../employee/authorization/employeePositionAuthority');
const {
  STORE_PAYMENT_ACCOUNT_CAPABILITY,
  requireStorePaymentAccountRead,
  requireStorePaymentAccountManage,
} = require('./storePaymentAccountAuthorization');

const READ = POSITION_CAPABILITIES.FINANCE_BANK_READ;
const MANAGE = POSITION_CAPABILITIES.FINANCE_BANK_MANAGE;
const routeSource = fs.readFileSync(path.join(__dirname, 'storePaymentAccountRoutes.js'), 'utf8');

const run = (middleware, user) => new Promise((resolve) => {
  middleware({ user }, {}, (error) => resolve(error || null));
});

test('legacy employee roles retain historical read access but not admin-only mutation authority', async () => {
  for (const role of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const user = { role: 'EMPLOYEE', employeeRole: role, positionCapabilities: null };
    assert.equal(await run(requireStorePaymentAccountRead, user), null, `${role} should retain read access`);
    const manageError = await run(requireStorePaymentAccountManage, user);
    assert.equal(manageError?.statusCode, 403, `${role} should not gain legacy mutation access`);
  }
});

test('migrated positions may explicitly opt into store payment account management', async () => {
  const readOnly = { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [READ] };
  const manager = { role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [READ, MANAGE] };
  const empty = { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] };

  assert.equal(await run(requireStorePaymentAccountRead, readOnly), null);
  assert.equal((await run(requireStorePaymentAccountManage, readOnly))?.statusCode, 403);
  assert.equal(await run(requireStorePaymentAccountManage, manager), null);
  assert.equal((await run(requireStorePaymentAccountRead, empty))?.statusCode, 403);
});

test('platform admins retain store payment account authority', async () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    const user = { role, positionCapabilities: [] };
    assert.equal(await run(requireStorePaymentAccountRead, user), null);
    assert.equal(await run(requireStorePaymentAccountManage, user), null);
  }
});

test('store payment account routes reuse finance bank read/manage capabilities with legacy mutation isolation', () => {
  assert.deepEqual(STORE_PAYMENT_ACCOUNT_CAPABILITY, { READ, MANAGE });
  assert.match(routeSource, /router\.get\('\/', requireStorePaymentAccountRead, controller\.list\)/);
  assert.match(routeSource, /router\.get\('\/:id', requireStorePaymentAccountRead, controller\.get\)/);
  assert.match(routeSource, /router\.post\('\/', requireStorePaymentAccountManage, controller\.create\)/);
  assert.match(routeSource, /router\.patch\('\/:id', requireStorePaymentAccountManage, controller\.update\)/);
  assert.doesNotMatch(routeSource, /requireAdmin|OWNER|MANAGER|CASHIER|TECHNICIAN/);
});
