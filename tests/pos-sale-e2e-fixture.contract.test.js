'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const fixture = read('scripts/provision-pos-sale-e2e-fixture.js');
const wrapper = read('scripts/run-test-database-runtime.js');
const packageJson = JSON.parse(read('package.json'));

assert.match(fixture, /assertTestDatabaseAuthority\([\s\S]*requiresWriteApproval: true/);
assert.match(fixture, /POS_SALE_E2E_FIXTURE_APPROVAL/);
assert.match(fixture, /delete authorityEnv\.DATABASE_URL/);
assert.match(fixture, /delete authorityEnv\.DIRECT_URL/);
assert.match(fixture, /ALPHATECH_POS_SALE_E2E_FIXTURE/);
assert.match(fixture, /status: 'IN_STOCK'/);
assert.match(fixture, /SYSTEM_POS_SALE_E2E/);
assert.match(fixture, /crypto\.randomBytes/);
assert.match(fixture, /role: 'ADMIN'/);
assert.doesNotMatch(fixture, /role: 'SUPERADMIN'/);
assert.match(wrapper, /provision-pos-sale-e2e-fixture\.js/);
assert.equal(
  packageJson.scripts['provision:pos-sale-e2e-fixture'],
  'node scripts/run-test-database-runtime.js scripts/provision-pos-sale-e2e-fixture.js'
);

console.log('POS Sale E2E fixture authority contract: PASS');
