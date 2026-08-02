'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const script = fs.readFileSync(
  path.join(process.cwd(), 'scripts/verify-partner-store-application-http-e2e.js'),
  'utf8'
)

assert.match(script, /async function synchronizeUserIdentitySequence\(\)/)
assert.match(script, /pg_get_serial_sequence\('\"User\"', 'id'\)/)
assert.match(script, /SELECT MAX\(id\) FROM \"User\"/)
assert.match(script, /EXISTS \(SELECT 1 FROM \"User\"\)/)
assert.match(script, /await synchronizeUserIdentitySequence\(\)/)
assert.ok(
  script.indexOf('await synchronizeUserIdentitySequence()') < script.indexOf('prisma.user.create'),
  'User identity sequence must be synchronized before the first test user is created'
)

console.log('partner-store-application-http-e2e-sequence.contract.test.js: PASS')
