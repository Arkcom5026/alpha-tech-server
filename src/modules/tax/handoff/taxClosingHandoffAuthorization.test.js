'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const READ = POSITION_CAPABILITIES.TAX_CLOSING_HANDOFF_READ;
const FINALIZE = POSITION_CAPABILITIES.TAX_CLOSING_HANDOFF_FINALIZE;

test('legacy tax closing handoff authority preserves OWNER and MANAGER only', () => {
  for (const employeeRole of ['OWNER', 'MANAGER']) {
    assert.equal(hasCapability({ employeeRole }, READ), true);
    assert.equal(hasCapability({ employeeRole }, FINALIZE), true);
  }
  for (const employeeRole of ['CASHIER', 'TECHNICIAN']) {
    assert.equal(hasCapability({ employeeRole }, READ), false);
    assert.equal(hasCapability({ employeeRole }, FINALIZE), false);
  }
});

test('migrated positions require explicit closing handoff capabilities', () => {
  assert.equal(hasCapability({ positionCapabilities: [READ] }, READ), true);
  assert.equal(hasCapability({ positionCapabilities: [READ] }, FINALIZE), false);
  assert.equal(hasCapability({ positionCapabilities: [FINALIZE] }, READ), false);
  assert.equal(hasCapability({ positionCapabilities: [] }, READ), false);
  assert.equal(hasCapability({ positionCapabilities: [] }, FINALIZE), false);
});

test('platform admin retains closing handoff authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    assert.equal(hasCapability({ role, positionCapabilities: [] }, READ), true);
    assert.equal(hasCapability({ role, positionCapabilities: [] }, FINALIZE), true);
  }
});

test('closing handoff routes separate read and elevated finalize authority', () => {
  const routes = read('src/modules/tax/periods/taxPeriodRoutes.js');
  const controller = read('src/modules/tax/handoff/taxClosingHandoffController.js');

  assert.match(routes, /allowTaxClosingHandoffCapabilities\(\s*TAX_CLOSING_HANDOFF_CAPABILITY\.READ,?\s*\)/);
  assert.match(routes, /allowTaxClosingHandoffCapabilities\(\s*TAX_CLOSING_HANDOFF_CAPABILITY\.READ,\s*TAX_CLOSING_HANDOFF_CAPABILITY\.FINALIZE,?\s*\)/);
  assert.match(routes, /router\.get\('\/tax-closing-handoff\/:taxPeriodId', allowTaxClosingHandoffRead, taxClosingHandoffController\.getBundle\)/);
  assert.match(routes, /router\.post\('\/tax-closing-handoff\/:taxPeriodId\/finalize', allowTaxClosingHandoffFinalize, taxClosingHandoffController\.finalizeBundle\)/);
  assert.doesNotMatch(controller, /\['OWNER', 'MANAGER'\]/);
  assert.match(controller, /TAX_CLOSING_HANDOFF_BRANCH_FORBIDDEN/);
});
