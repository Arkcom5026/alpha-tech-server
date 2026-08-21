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
const READ = POSITION_CAPABILITIES.TAX_VAT_SETTLEMENT_READ;

test('legacy VAT settlement authority preserves OWNER and MANAGER only', () => {
  for (const employeeRole of ['OWNER', 'MANAGER']) {
    assert.equal(hasCapability({ employeeRole }, READ), true);
  }
  for (const employeeRole of ['CASHIER', 'TECHNICIAN']) {
    assert.equal(hasCapability({ employeeRole }, READ), false);
  }
});

test('migrated positions require explicit VAT settlement read capability', () => {
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ] }, READ), true);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [] }, READ), false);
});

test('platform admin retains VAT settlement authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    assert.equal(hasCapability({ role, positionCapabilities: [] }, READ), true);
  }
});

test('VAT settlement route is position-gated while controller retains branch isolation', () => {
  const routes = read('src/modules/tax/periods/taxPeriodRoutes.js');
  const controller = read('src/modules/tax/settlement/vatSettlementController.js');

  assert.match(routes, /allowVatSettlementCapabilities\(\s*TAX_VAT_SETTLEMENT_CAPABILITY\.READ,?\s*\)/);
  assert.match(routes, /router\.get\('\/vat-settlement\/:taxPeriodId', allowVatSettlementRead, vatSettlementController\.getPreparation\)/);
  assert.doesNotMatch(controller, /OWNER.*MANAGER|MANAGER.*OWNER/);
  assert.doesNotMatch(controller, /VAT_SETTLEMENT_ACCESS_FORBIDDEN/);
  assert.match(controller, /VAT_SETTLEMENT_BRANCH_FORBIDDEN/);

  // Carry-forward and withholding-tax authority remain outside Wave 2X.
  assert.match(routes, /router\.get\('\/vat-carry-forward\/:taxPeriodId', vatCarryForwardController\.getAuthority\)/);
  assert.match(routes, /router\.post\('\/vat-carry-forward\/:taxPeriodId\/confirm', vatCarryForwardController\.confirmAuthority\)/);
  assert.match(routes, /router\.get\('\/withholding-tax\/:taxPeriodId', withholdingTaxController\.getWorkspace\)/);
});
