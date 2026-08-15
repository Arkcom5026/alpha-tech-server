const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const routes = read('src/modules/partnerStore/application/partnerStoreApplicationRoutes.js');
const canonicalVerifier = read('scripts/verify-partner-store-application-http-e2e.js');
const retiredVerifier = read('scripts/verify-partner-store-application-runtime.js');
const testRuntimeWrapper = read('scripts/run-test-database-runtime.js');

assert.ok(routes.includes("adminRouter.post('/:id/review', adminController.startReview)"));
assert.ok(routes.includes("adminRouter.post('/:id/approve', adminController.approve)"));
assert.ok(routes.includes("adminRouter.post('/:id/provision', adminController.provision)"));
assert.ok(routes.includes("adminRouter.post('/:id/activation-invitations', activationController.issueInvitation)"));
assert.ok(routes.indexOf("/:id/review") < routes.indexOf("/:id/approve"));
assert.ok(routes.indexOf("/:id/approve") < routes.indexOf("/:id/provision"));
assert.ok(routes.indexOf("/:id/provision") < routes.indexOf("/:id/activation-invitations"));

for (const stage of [
  '/review`',
  '/approve`',
  '/provision`',
  '/activation-invitations`',
  "'/api/public/partner-store-applications/activation/claim'",
  "'/api/partner-store/onboarding/complete'",
  "'/api/partner-store/readiness/certify'",
]) {
  assert.ok(canonicalVerifier.includes(stage), `canonical verifier must retain stage ${stage}`);
}

assert.ok(retiredVerifier.includes('RETIRED_PARTNER_STORE_RUNTIME_VERIFIER'));
assert.ok(retiredVerifier.includes('verify:partner-store-application-http-e2e:test'));
assert.ok(!testRuntimeWrapper.includes("'scripts/verify-partner-store-application-runtime.js'"));
assert.ok(testRuntimeWrapper.includes("'scripts/verify-partner-store-application-http-e2e.js'"));

console.log('partner store application provisioning compatibility contract: PASS');
