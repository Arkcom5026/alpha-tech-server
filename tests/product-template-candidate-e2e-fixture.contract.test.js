'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const provisioner = read('scripts/provision-product-template-candidate-e2e-fixture.js');
const verifier = read('scripts/verify-product-template-candidate-e2e-outcome.js');

assert.match(provisioner, /assertTestDatabaseAuthority/);
assert.match(provisioner, /requiresWriteApproval:\s*true/);
assert.match(provisioner, /PRODUCT_TEMPLATE_CANDIDATE_E2E_FIXTURE_APPROVAL/);
assert.match(provisioner, /ALPHATECH_PRODUCT_TEMPLATE_CANDIDATE_E2E_FIXTURE/);
assert.match(provisioner, /\.env\.restore/);
assert.match(provisioner, /RESTORE_DATABASE_URL|RECOVERY_DATABASE_URL/);
assert.doesNotMatch(provisioner, /process\.env\.DATABASE_URL\s*\|\|/);

for (const purpose of ['REJECT', 'MERGE', 'PROMOTE']) {
  assert.match(provisioner, new RegExp(`['\"]${purpose}['\"]`), `Missing ${purpose} fixture path`);
}

for (const key of [
  'PRODUCT_TEMPLATE_E2E_REJECT_CANDIDATE_ID',
  'PRODUCT_TEMPLATE_E2E_MERGE_CANDIDATE_ID',
  'PRODUCT_TEMPLATE_E2E_PROMOTE_CANDIDATE_ID',
  'PRODUCT_TEMPLATE_E2E_TARGET_TEMPLATE_PRODUCT_ID',
]) {
  assert.match(provisioner, new RegExp(key), `Provisioner must emit ${key}`);
  assert.match(verifier, new RegExp(key), `Verifier must consume ${key}`);
}

assert.match(provisioner, /productTemplateCandidate\.create/);
assert.match(provisioner, /productTemplateCandidateEvent\.create/);
assert.match(provisioner, /eventType:\s*['\"]CREATED['\"]/);
assert.match(provisioner, /resultingStatus:\s*['\"]DRAFT['\"]/);
assert.match(provisioner, /retainedTestData:\s*true/);

assert.match(verifier, /assertTestDatabaseAuthority/);
assert.match(verifier, /requiresWriteApproval:\s*false/);
assert.match(verifier, /productTemplateCandidate\.findUnique/);
assert.match(verifier, /status:\s*['\"]REJECTED['\"]/);
assert.match(verifier, /status:\s*['\"]MERGED['\"]/);
assert.match(verifier, /status:\s*['\"]PROMOTED['\"]/);
assert.match(verifier, /REVIEW_STARTED/);
assert.match(verifier, /targetTemplateProductId/);
assert.doesNotMatch(verifier, /\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/);

console.log('product-template-candidate-e2e-fixture.contract.test.js: PASS');
