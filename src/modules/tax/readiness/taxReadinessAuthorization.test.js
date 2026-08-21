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
const READ = POSITION_CAPABILITIES.TAX_READINESS_READ;

test('legacy tax readiness authority preserves OWNER and MANAGER only', () => {
  for (const employeeRole of ['OWNER', 'MANAGER']) {
    assert.equal(hasCapability({ employeeRole }, READ), true);
  }
  for (const employeeRole of ['CASHIER', 'TECHNICIAN']) {
    assert.equal(hasCapability({ employeeRole }, READ), false);
  }
});

test('migrated positions require explicit tax readiness read capability', () => {
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ] }, READ), true);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [] }, READ), false);
});

test('platform admin retains tax readiness authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    assert.equal(hasCapability({ role, positionCapabilities: [] }, READ), true);
  }
});

test('tax readiness route is position-gated while controller retains branch isolation', () => {
  const routes = read('src/modules/tax/periods/taxPeriodRoutes.js');
  const controller = read('src/modules/tax/readiness/unifiedTaxReadinessController.js');

  assert.match(routes, /allowTaxReadinessCapabilities\(\s*TAX_READINESS_CAPABILITY\.READ,?\s*\)/);
  assert.match(routes, /router\.get\('\/tax-readiness\/:taxPeriodId', allowTaxReadinessRead, unifiedTaxReadinessController\.getWorkspace\)/);
  assert.doesNotMatch(controller, /OWNER.*MANAGER|MANAGER.*OWNER/);
  assert.doesNotMatch(controller, /TAX_READINESS_ACCESS_FORBIDDEN/);
  assert.match(controller, /TAX_READINESS_BRANCH_FORBIDDEN/);

  // Adjacent tax administration surfaces stay explicit as later waves claim them.
  assert.match(routes, /router\.get\('\/vat-settlement\/:taxPeriodId', allowVatSettlementRead, vatSettlementController\.getPreparation\)/);
  assert.match(routes, /router\.get\('\/vat-carry-forward\/:taxPeriodId', allowVatCarryForwardRead, vatCarryForwardController\.getAuthority\)/);
  assert.match(routes, /router\.post\('\/vat-carry-forward\/:taxPeriodId\/confirm', allowVatCarryForwardConfirm, vatCarryForwardController\.confirmAuthority\)/);
  assert.match(routes, /router\.get\('\/withholding-tax\/:taxPeriodId', withholdingTaxController\.getWorkspace\)/);
});
