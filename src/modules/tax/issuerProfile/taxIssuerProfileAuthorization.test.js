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
const READ = POSITION_CAPABILITIES.TAX_ISSUER_PROFILE_READ;
const MANAGE = POSITION_CAPABILITIES.TAX_ISSUER_PROFILE_MANAGE;

test('legacy tax issuer profile authority preserves OWNER and MANAGER only', () => {
  for (const employeeRole of ['OWNER', 'MANAGER']) {
    assert.equal(hasCapability({ employeeRole }, READ), true);
    assert.equal(hasCapability({ employeeRole }, MANAGE), true);
  }
  for (const employeeRole of ['CASHIER', 'TECHNICIAN']) {
    assert.equal(hasCapability({ employeeRole }, READ), false);
    assert.equal(hasCapability({ employeeRole }, MANAGE), false);
  }
});

test('migrated positions separate tax issuer profile read and manage authority', () => {
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ] }, READ), true);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ] }, MANAGE), false);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ, MANAGE] }, MANAGE), true);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [] }, READ), false);
});

test('platform admin retains tax issuer profile authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    assert.equal(hasCapability({ role, positionCapabilities: [] }, READ), true);
    assert.equal(hasCapability({ role, positionCapabilities: [] }, MANAGE), true);
  }
});

test('tax issuer profile routes split read and elevated manage authority while controller retains branch isolation', () => {
  const routes = read('src/modules/tax/issuerProfile/routes/taxIssuerProfileRoutes.js');
  const controller = read('src/modules/tax/issuerProfile/routes/taxIssuerProfileController.js');

  assert.match(routes, /allowTaxIssuerProfileCapabilities\(\s*TAX_ISSUER_PROFILE_CAPABILITY\.READ,?\s*\)/);
  assert.match(routes, /allowTaxIssuerProfileCapabilities\(\s*TAX_ISSUER_PROFILE_CAPABILITY\.READ,\s*TAX_ISSUER_PROFILE_CAPABILITY\.MANAGE,?\s*\)/);
  assert.match(routes, /router\.get\('\/', allowTaxIssuerProfileRead, controller\.getCurrentTaxIssuerProfile\)/);
  assert.match(routes, /router\.put\('\/', allowTaxIssuerProfileManage, controller\.upsertCurrentTaxIssuerProfile\)/);
  assert.doesNotMatch(controller, /OWNER.*MANAGER|MANAGER.*OWNER/);
  assert.doesNotMatch(controller, /TAX_ISSUER_PROFILE_ACCESS_FORBIDDEN/);
  assert.match(controller, /TAX_ISSUER_PROFILE_BRANCH_FORBIDDEN/);
  assert.match(controller, /TAX_ISSUER_PROFILE_BRANCH_REQUIRED/);
});
