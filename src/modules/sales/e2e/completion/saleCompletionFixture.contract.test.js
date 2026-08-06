'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const packageRoot = __dirname;
const serverRoot = path.resolve(packageRoot, '..', '..', '..', '..', '..');
const readPackage = (file) => fs.readFileSync(path.join(packageRoot, file), 'utf8');
const readServer = (file) => fs.readFileSync(path.join(serverRoot, file), 'utf8');

const fixture = readPackage('provisionSaleCompletionFixture.js');
const authority = readPackage('saleCompletionE2ERuntimeAuthority.js');
const packageJson = JSON.parse(readServer('package.json'));

assert.match(authority, /assertTestDatabaseAuthority/);
assert.match(authority, /requiresWriteApproval: requiresWrite/);
assert.match(authority, /POS_SALE_E2E_FIXTURE_APPROVAL/);
assert.match(authority, /ALPHATECH_POS_SALE_E2E_FIXTURE/);
assert.match(fixture, /resolveSaleCompletionE2ERuntimeAuthority\(\{ requiresWrite: true \}\)/);
assert.match(fixture, /status: 'IN_STOCK'/);
assert.match(fixture, /SYSTEM_POS_SALE_E2E/);
assert.match(fixture, /crypto\.randomBytes/);
assert.match(fixture, /role: 'ADMIN'/);
assert.doesNotMatch(fixture, /role: 'SUPERADMIN'/);
assert.match(fixture, /customer is created only through the real POS Browser flow/);
assert.doesNotMatch(fixture, /customerProfile\.(create|upsert)/);
assert.equal(
  packageJson.scripts['provision:pos-sale-e2e-fixture'],
  'node src/modules/sales/e2e/completion/provisionSaleCompletionFixture.js'
);

console.log('Sale completion E2E fixture authority contract: PASS');
