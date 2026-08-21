const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');
const {
  QUICK_RECEIPT_CAPABILITY,
  allowQuickReceiptCapabilities,
} = require('./quickReceiptAuthorization');

const ACCESS = POSITION_CAPABILITIES.INVENTORY_QUICK_RECEIPT;
const FINALIZE = POSITION_CAPABILITIES.INVENTORY_QUICK_RECEIPT_FINALIZE;

assert.equal(QUICK_RECEIPT_CAPABILITY.ACCESS, ACCESS);
assert.equal(QUICK_RECEIPT_CAPABILITY.FINALIZE, FINALIZE);

for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
  const actor = { role: 'EMPLOYEE', employeeRole, positionCapabilities: null };
  assert.equal(hasCapability(actor, ACCESS), true, `legacy ${employeeRole} must preserve quick receipt access during migration`);
  assert.equal(hasCapability(actor, FINALIZE), true, `legacy ${employeeRole} must preserve quick receipt finalization during migration`);
}

assert.equal(hasCapability({ role: 'EMPLOYEE', employeeRole: 'MANAGER', positionCapabilities: [] }, ACCESS), false);
assert.equal(hasCapability({ role: 'EMPLOYEE', employeeRole: 'MANAGER', positionCapabilities: [] }, FINALIZE), false);
assert.equal(hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [ACCESS] }, ACCESS), true);
assert.equal(hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [ACCESS] }, FINALIZE), false, 'draft authority must not imply finalize authority');
assert.equal(hasCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [FINALIZE] }, ACCESS), false, 'finalize capability alone must not imply session access');
assert.equal(hasCapability({ role: 'ADMIN', employeeRole: 'CASHIER', positionCapabilities: [] }, ACCESS), true);
assert.equal(hasCapability({ role: 'ADMIN', employeeRole: 'CASHIER', positionCapabilities: [] }, FINALIZE), true);

const runMiddleware = (requiredCapabilities, user) => {
  let nextArg = Symbol('not-called');
  allowQuickReceiptCapabilities(...requiredCapabilities)(
    { user },
    {},
    (error) => { nextArg = error; },
  );
  return nextArg;
};

assert.equal(runMiddleware([ACCESS], { role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [ACCESS] }), undefined);
const finalizeDenied = runMiddleware([ACCESS, FINALIZE], { role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [ACCESS] });
assert.equal(finalizeDenied?.code, 'QUICK_RECEIPT_FORBIDDEN');
assert.equal(finalizeDenied?.statusCode, 403);
assert.deepEqual(finalizeDenied?.details?.requiredCapabilities, [ACCESS, FINALIZE]);
assert.equal(runMiddleware([ACCESS, FINALIZE], { role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [ACCESS, FINALIZE] }), undefined);

const routeSource = fs.readFileSync(path.join(__dirname, '../routes/quickStockRoutes.js'), 'utf8');
assert.match(routeSource, /const allowQuickReceiptAccess = allowQuickReceiptCapabilities\(QUICK_RECEIPT_CAPABILITY\.ACCESS\)/);
assert.match(routeSource, /const allowQuickReceiptFinalize = allowQuickReceiptCapabilities\(\s*QUICK_RECEIPT_CAPABILITY\.ACCESS,\s*QUICK_RECEIPT_CAPABILITY\.FINALIZE,?\s*\)/s);
assert.match(routeSource, /router\.get\('\/receipts', allowQuickReceiptAccess, quickReceiptSessionController\.list\)/);
assert.match(routeSource, /router\.post\('\/receipts', allowQuickReceiptAccess, quickReceiptSessionController\.create\)/);
assert.match(routeSource, /router\.patch\('\/receipts\/:id', allowQuickReceiptAccess, quickReceiptSessionController\.update\)/);
assert.match(routeSource, /router\.post\('\/receipts\/complete', allowQuickReceiptFinalize, quickReceiptSessionController\.complete\)/);
assert.match(routeSource, /router\.post\('\/receipts\/:id\/finalize', allowQuickReceiptFinalize, quickReceiptSessionController\.finalize\)/);
assert.match(routeSource, /router\.post\('\/receipts\/:id\/cancel', allowQuickReceiptFinalize, quickReceiptSessionController\.cancel\)/);

console.log('✅ Quick Receipt position authority contract passed');
