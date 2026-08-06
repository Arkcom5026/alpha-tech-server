'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const packageRoot = __dirname;
const serverRoot = path.resolve(packageRoot, '..', '..', '..', '..', '..');
const readPackage = (file) => fs.readFileSync(path.join(packageRoot, file), 'utf8');
const readServer = (file) => fs.readFileSync(path.join(serverRoot, file), 'utf8');

const executableVerifier = readPackage('verifySaleCompletionOutcome.js');
const verifier = readPackage('verify/verifySaleCompletionOutcome.js');
const wrapper = readServer('scripts/verify-pos-sale-e2e-outcome.js');
const packageJson = JSON.parse(readServer('package.json'));

assert.match(executableVerifier, /resolveSaleCompletionE2ERuntimeAuthority/);
assert.match(executableVerifier, /databaseModified: false/);
assert.match(executableVerifier, /verifySaleCompletionOutcome/);
assert.match(verifier, /prisma\.sale\.findFirst/);
assert.match(verifier, /prisma\.payment\.findMany/);
assert.match(verifier, /prisma\.stockMovement\.findMany/);
assert.match(verifier, /branchId: normalizedBranchId/);
assert.match(verifier, /simpleItems: true/);
assert.match(verifier, /completionCommand: true/);
assert.doesNotMatch(verifier, /\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/);
assert.match(wrapper, /src\/modules\/sales\/e2e\/completion\/verifySaleCompletionOutcome/);
assert.equal(
  packageJson.scripts['verify:pos-sale-e2e-outcome'],
  'node scripts/verify-pos-sale-e2e-outcome.js'
);
assert.equal(
  packageJson.scripts['test:pos-sale-e2e-outcome'],
  'node tests/pos-sale-e2e-outcome.contract.test.js'
);

console.log('Sale completion E2E outcome verifier contract: PASS');
