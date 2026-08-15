const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const workflow = read('.github/workflows/backend-ci.yml');
const packageJson = JSON.parse(read('package.json'));
const wrapper = read('scripts/run-test-database-runtime.js');
const canonicalPartnerStore = read('scripts/verify-partner-store-application-http-e2e.js');
const retiredPartnerStore = read('scripts/verify-partner-store-application-runtime.js');

assert.doesNotMatch(workflow, /integration\/system-hardening-7-agendas/, 'legacy integration branch must not remain an execution authority');
assert.match(workflow, /branches:\s*\n\s*- main/, 'main must remain the CI integration authority');

assert.equal(
  packageJson.scripts['verify:partner-store-application-http-e2e:test'],
  'node scripts/run-test-database-runtime.js scripts/verify-partner-store-application-http-e2e.js'
);
assert.match(canonicalPartnerStore, /SUBMITTED/);
assert.match(canonicalPartnerStore, /UNDER_REVIEW/);
assert.match(canonicalPartnerStore, /APPROVED/);
assert.match(canonicalPartnerStore, /PROVISIONED/);
assert.match(canonicalPartnerStore, /ACTIVE/);
assert.match(canonicalPartnerStore, /ONBOARDING_COMPLETED/);
assert.match(canonicalPartnerStore, /OPERATIONAL_CERTIFIED/);

assert.doesNotMatch(wrapper, /ALLOW_PARTNER_STORE_RUNTIME_TEST/, 'retired pre-V2 runtime authority must not be injected');
assert.doesNotMatch(wrapper, /verify-partner-store-application-runtime\.js/, 'retired pre-V2 verifier must not be allow-listed');
assert.match(wrapper, /verify-partner-store-application-http-e2e\.js/, 'canonical HTTP E2E verifier must remain allow-listed');

assert.match(retiredPartnerStore, /RETIRED_PARTNER_STORE_RUNTIME_VERIFIER/, 'legacy entrypoint must fail closed');
assert.match(retiredPartnerStore, /verify:partner-store-application-http-e2e:test/, 'legacy entrypoint must direct operators to canonical authority');

console.log('Canonical E2E Authority Cleanup Contract: PASS');
