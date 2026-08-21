'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
const READ = POSITION_CAPABILITIES.TAX_VAT_CARRY_FORWARD_READ;
const CONFIRM = POSITION_CAPABILITIES.TAX_VAT_CARRY_FORWARD_CONFIRM;

test('legacy VAT carry-forward authority preserves OWNER and MANAGER only', () => {
  for (const employeeRole of ['OWNER', 'MANAGER']) {
    assert.equal(hasCapability({ employeeRole }, READ), true);
    assert.equal(hasCapability({ employeeRole }, CONFIRM), true);
  }
  for (const employeeRole of ['CASHIER', 'TECHNICIAN']) {
    assert.equal(hasCapability({ employeeRole }, READ), false);
    assert.equal(hasCapability({ employeeRole }, CONFIRM), false);
  }
});

test('migrated positions separate read and confirm authority', () => {
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ] }, READ), true);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ] }, CONFIRM), false);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ, CONFIRM] }, CONFIRM), true);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [] }, READ), false);
});

test('platform admin retains VAT carry-forward authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    assert.equal(hasCapability({ role, positionCapabilities: [] }, READ), true);
    assert.equal(hasCapability({ role, positionCapabilities: [] }, CONFIRM), true);
  }
});

test('VAT carry-forward routes split read and elevated confirm authority while controller retains branch isolation', () => {
  const routes = read('src/modules/tax/periods/taxPeriodRoutes.js');
  const controller = read('src/modules/tax/settlement/vatCarryForwardController.js');

  assert.match(routes, /allowVatCarryForwardCapabilities\(\s*TAX_VAT_CARRY_FORWARD_CAPABILITY\.READ,?\s*\)/);
  assert.match(routes, /allowVatCarryForwardCapabilities\(\s*TAX_VAT_CARRY_FORWARD_CAPABILITY\.READ,\s*TAX_VAT_CARRY_FORWARD_CAPABILITY\.CONFIRM,?\s*\)/);
  assert.match(routes, /router\.get\('\/vat-carry-forward\/:taxPeriodId', allowVatCarryForwardRead, vatCarryForwardController\.getAuthority\)/);
  assert.match(routes, /router\.post\('\/vat-carry-forward\/:taxPeriodId\/confirm', allowVatCarryForwardConfirm, vatCarryForwardController\.confirmAuthority\)/);
  assert.doesNotMatch(controller, /OWNER.*MANAGER|MANAGER.*OWNER/);
  assert.doesNotMatch(controller, /VAT_CARRY_FORWARD_ACCESS_FORBIDDEN/);
  assert.match(controller, /VAT_CARRY_FORWARD_BRANCH_FORBIDDEN/);

  // Withholding tax remains outside Wave 2Y.
  assert.match(routes, /router\.get\('\/withholding-tax\/:taxPeriodId', withholdingTaxController\.getWorkspace\)/);
});
