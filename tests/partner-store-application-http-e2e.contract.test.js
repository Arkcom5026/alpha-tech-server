'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const runner = read('scripts/run-test-database-runtime.js')
const verifier = read('scripts/verify-partner-store-application-http-e2e.js')
const packageJson = JSON.parse(read('package.json'))

assert.ok(runner.includes('verify-partner-store-application-http-e2e.js'))
assert.equal(
  packageJson.scripts['verify:partner-store-application-http-e2e:test'],
  'node scripts/run-test-database-runtime.js scripts/verify-partner-store-application-http-e2e.js'
)
assert.ok(verifier.includes("ALLOW_PARTNER_STORE_HTTP_E2E_TEST !== 'true'"))
assert.ok(verifier.includes("ALPHATECH_RUNTIME_ENV !== 'TEST'"))
assert.ok(verifier.includes("'/api/public/partner-store-applications'"))
assert.ok(verifier.includes('/review`'))
assert.ok(verifier.includes('/approve`'))
assert.ok(verifier.includes('/provision`'))
assert.ok(verifier.includes('/activation-invitations`'))
assert.ok(verifier.includes("'/api/public/partner-store-applications/activation/claim'"))
assert.ok(verifier.includes("'/api/partner-store/onboarding/me'"))
assert.ok(verifier.includes("'/api/partner-store/onboarding/complete'"))
assert.ok(verifier.includes("'/api/partner-store/readiness/me'"))
assert.ok(verifier.includes("'/api/partner-store/readiness/certify'"))
assert.ok(verifier.includes("role: 'SUPERADMIN'"))
assert.ok(verifier.includes('anonymousApproval.status, 401'))
assert.ok(verifier.includes('rejectedDeliveryOnlyCertification.status, 409'))
assert.ok(verifier.includes("certificationFulfillmentAuthority, 'PICKUP'"))
assert.ok(verifier.includes("deliveryCertificationSupported, false"))
assert.ok(verifier.includes("operationalReadinessStatus, 'CERTIFIED'"))
assert.ok(verifier.includes("JWT_SECRET: jwtSecret"))
assert.ok(!verifier.includes('PARTNER_STORE_APPLICATION_NOT_ACTIONABLE'))
assert.ok(!verifier.includes('repeatedApproval'))
assert.ok(!verifier.includes('npm start'))

console.log('partner store application HTTP E2E contract: PASS')
