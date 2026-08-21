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

const PERIOD_CAPABILITIES = [
  POSITION_CAPABILITIES.TAX_PERIOD_READ,
  POSITION_CAPABILITIES.TAX_PERIOD_MANAGE,
  POSITION_CAPABILITIES.TAX_PERIOD_REOPEN,
];

test('legacy tax period authority preserves OWNER and MANAGER only', () => {
  for (const role of ['OWNER', 'MANAGER']) {
    for (const capability of PERIOD_CAPABILITIES) {
      assert.equal(hasCapability({ employeeRole: role }, capability), true);
    }
  }

  for (const role of ['CASHIER', 'TECHNICIAN']) {
    for (const capability of PERIOD_CAPABILITIES) {
      assert.equal(hasCapability({ employeeRole: role }, capability), false);
    }
  }
});

test('migrated positions require explicit tax period capabilities', () => {
  const actor = {
    employeeRole: 'OWNER',
    positionCapabilities: [POSITION_CAPABILITIES.TAX_PERIOD_READ],
  };

  assert.equal(hasCapability(actor, POSITION_CAPABILITIES.TAX_PERIOD_READ), true);
  assert.equal(hasCapability(actor, POSITION_CAPABILITIES.TAX_PERIOD_MANAGE), false);
  assert.equal(hasCapability(actor, POSITION_CAPABILITIES.TAX_PERIOD_REOPEN), false);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [] }, POSITION_CAPABILITIES.TAX_PERIOD_READ), false);
});

test('platform admin retains all tax period authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    for (const capability of PERIOD_CAPABILITIES) {
      assert.equal(hasCapability({ role, positionCapabilities: [] }, capability), true);
    }
  }
});

test('tax period routes separate read, manage, and elevated reopen authority', () => {
  const routes = read('src/modules/tax/periods/taxPeriodRoutes.js');
  const controller = read('src/modules/tax/periods/taxPeriodController.js');

  assert.match(routes, /router\.get\('\/periods', allowTaxPeriodRead, controller\.listPeriods\)/);
  assert.match(routes, /router\.get\('\/periods\/summary', allowTaxPeriodRead, controller\.getPeriodSummary\)/);
  assert.match(routes, /router\.get\('\/periods\/:taxPeriodId', allowTaxPeriodRead, controller\.getPeriodDetail\)/);
  assert.match(routes, /router\.post\('\/periods\/ensure', allowTaxPeriodManage, controller\.ensureMonthlyPeriod\)/);
  assert.match(routes, /router\.post\('\/periods\/:taxPeriodId\/close', allowTaxPeriodManage, controller\.closePeriod\)/);
  assert.match(routes, /router\.post\('\/periods\/:taxPeriodId\/lock', allowTaxPeriodManage, controller\.lockPeriod\)/);
  assert.match(routes, /router\.post\('\/periods\/:taxPeriodId\/submit', allowTaxPeriodManage, controller\.submitPeriod\)/);
  assert.match(routes, /router\.post\('\/periods\/:taxPeriodId\/reopen', allowTaxPeriodReopen, controller\.reopenPeriod\)/);
  assert.match(routes, /TAX_PERIOD_CAPABILITY\.MANAGE,[\s\S]*TAX_PERIOD_CAPABILITY\.REOPEN/);

  assert.doesNotMatch(controller, /OWNER.*MANAGER|MANAGER.*OWNER/);
  assert.match(controller, /TAX_PERIOD_ADMINISTRATIVE_BRANCH_FORBIDDEN/);

  // Accounting Office remains outside the tax-period wave. Tax Closing Handoff is
  // now owned by its adjacent Position-authority boundary and must stay guarded.
  assert.match(routes, /router\.get\('\/accounting-office\/packages\/:taxPeriodId', accountingOfficeController\.getPackage\)/);
  assert.match(routes, /router\.post\('\/tax-closing-handoff\/:taxPeriodId\/finalize', allowTaxClosingHandoffFinalize, taxClosingHandoffController\.finalizeBundle\)/);
});
