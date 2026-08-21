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
const READ = POSITION_CAPABILITIES.TAX_PUBLICATION_RETRY_READ;
const EXECUTE = POSITION_CAPABILITIES.TAX_PUBLICATION_RETRY_EXECUTE;

const ALL = [READ, EXECUTE];

test('legacy publication retry authority preserves OWNER and MANAGER only', () => {
  for (const employeeRole of ['OWNER', 'MANAGER']) {
    for (const capability of ALL) assert.equal(hasCapability({ employeeRole }, capability), true);
  }
  for (const employeeRole of ['CASHIER', 'TECHNICIAN']) {
    for (const capability of ALL) assert.equal(hasCapability({ employeeRole }, capability), false);
  }
});

test('migrated positions separate publication retry read and execute authority', () => {
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ] }, READ), true);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ] }, EXECUTE), false);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ, EXECUTE] }, EXECUTE), true);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [] }, READ), false);
});

test('platform admin retains publication retry authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    for (const capability of ALL) assert.equal(hasCapability({ role, positionCapabilities: [] }, capability), true);
  }
});

test('publication retry routes split read from elevated execute authority', () => {
  const routes = read('src/modules/tax/publicationRetry/taxPublicationRetryRoutes.js');
  const auth = read('src/modules/tax/publicationRetry/taxPublicationRetryAuthorization.js');
  const intakeRoutes = read('src/modules/tax/http/taxIntakeRoutes.js');

  assert.match(routes, /allowTaxPublicationRetryCapabilities\(\s*TAX_PUBLICATION_RETRY_CAPABILITY\.READ,?\s*\)/);
  assert.match(routes, /allowTaxPublicationRetryCapabilities\(\s*TAX_PUBLICATION_RETRY_CAPABILITY\.READ,\s*TAX_PUBLICATION_RETRY_CAPABILITY\.EXECUTE,?\s*\)/);
  assert.match(routes, /router\.get\('\/gaps', allowPublicationRetryRead/);
  assert.match(routes, /router\.post\('\/retry-sale\/:saleId', allowPublicationRetryExecute/);
  assert.match(routes, /router\.post\('\/retry-all', allowPublicationRetryExecute/);
  assert.match(auth, /TAX_PUBLICATION_RETRY_FORBIDDEN/);
  assert.match(intakeRoutes, /router\.use\('\/publication', taxPublicationRetryRoutes\)/);
});
