'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const verifier = read('scripts/verify-pos-sale-e2e-outcome.js');
const fixture = read('scripts/provision-pos-sale-e2e-fixture.js');
const packageJson = JSON.parse(read('package.json'));

assert.match(verifier, /assertTestDatabaseAuthority\(/);
assert.match(verifier, /databaseModified: false/);
assert.match(verifier, /stockItem\.findUnique/);
assert.match(verifier, /status !== 'SOLD'/);
assert.match(verifier, /item\.sale\?\.branchId === stockItem\.branchId/);
assert.match(verifier, /statusPayment !== 'PAID'/);
assert.match(verifier, /sale\.customerId/);
assert.match(verifier, /sale\.customer\?\.user\?\.loginId/);
assert.match(verifier, /expectedCustomerPhone/);
assert.match(verifier, /branchEvidenceSaleId: sale\.id/);
assert.match(verifier, /Number\(item\.qty\) === -1/);
assert.doesNotMatch(verifier, /\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/);

assert.match(fixture, /customerName/);
assert.match(fixture, /customerPhone/);
assert.match(fixture, /customer is created only through the real POS browser flow/);
assert.doesNotMatch(fixture, /customerProfile\.(create|upsert)/);

assert.equal(packageJson.scripts['verify:pos-sale-e2e-outcome'], 'node scripts/verify-pos-sale-e2e-outcome.js');
assert.equal(packageJson.scripts['test:pos-sale-e2e-outcome'], 'node tests/pos-sale-e2e-outcome.contract.test.js');

console.log('POS Sale E2E outcome verifier contract: PASS');
