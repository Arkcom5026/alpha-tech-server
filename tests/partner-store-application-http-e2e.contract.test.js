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
assert.ok(verifier.includes("POST /api/public/partner-store-applications"))
assert.ok(verifier.includes("POST /api/partner-store/applications/:id/approve"))
assert.ok(verifier.includes("role: 'SUPERADMIN'"))
assert.ok(verifier.includes("role: 'CUSTOMER'"))
assert.ok(verifier.includes('anonymousApproval.status, 401'))
assert.ok(verifier.includes('repeatedApproval.status, 409'))
assert.ok(verifier.includes('PARTNER_STORE_APPLICATION_NOT_ACTIONABLE'))
assert.ok(verifier.includes("JWT_SECRET: jwtSecret"))
assert.ok(!verifier.includes("npm start"))

console.log('partner store application HTTP E2E contract: PASS')
