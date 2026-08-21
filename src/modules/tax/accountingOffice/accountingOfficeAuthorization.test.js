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
const READ = POSITION_CAPABILITIES.TAX_ACCOUNTING_OFFICE_READ;

test('legacy accounting office authority preserves OWNER and MANAGER only', () => {
  for (const employeeRole of ['OWNER', 'MANAGER']) {
    assert.equal(hasCapability({ employeeRole }, READ), true);
  }
  for (const employeeRole of ['CASHIER', 'TECHNICIAN']) {
    assert.equal(hasCapability({ employeeRole }, READ), false);
  }
});

test('migrated positions require explicit accounting office read capability', () => {
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ] }, READ), true);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [] }, READ), false);
});

test('platform admin retains accounting office authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    assert.equal(hasCapability({ role, positionCapabilities: [] }, READ), true);
  }
});

test('accounting office route is position-gated while controller retains branch isolation', () => {
  const routes = read('src/modules/tax/periods/taxPeriodRoutes.js');
  const controller = read('src/modules/tax/accountingOffice/accountingOfficePackageController.js');

  assert.match(routes, /allowAccountingOfficeCapabilities\(\s*TAX_ACCOUNTING_OFFICE_CAPABILITY\.READ,?\s*\)/);
  assert.match(routes, /router\.get\('\/accounting-office\/packages\/:taxPeriodId', allowAccountingOfficeRead, accountingOfficeController\.getPackage\)/);
  assert.doesNotMatch(controller, /OWNER.*MANAGER|MANAGER.*OWNER/);
  assert.doesNotMatch(controller, /ACCOUNTING_OFFICE_ACCESS_FORBIDDEN/);
  assert.match(controller, /ACCOUNTING_OFFICE_BRANCH_FORBIDDEN/);

  // Adjacent tax administration surfaces remain outside Wave 2V unless a later
  // Position-authority wave has explicitly claimed them.
  assert.match(routes, /router\.get\('\/tax-readiness\/:taxPeriodId', allowTaxReadinessRead, unifiedTaxReadinessController\.getWorkspace\)/);
  assert.match(routes, /router\.get\('\/vat-settlement\/:taxPeriodId', vatSettlementController\.getPreparation\)/);
  assert.match(routes, /router\.get\('\/vat-carry-forward\/:taxPeriodId', vatCarryForwardController\.getAuthority\)/);
  assert.match(routes, /router\.get\('\/withholding-tax\/:taxPeriodId', withholdingTaxController\.getWorkspace\)/);
});
