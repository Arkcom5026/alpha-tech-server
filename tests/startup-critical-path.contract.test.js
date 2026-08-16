'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = process.cwd()
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const scripts = packageJson.scripts || {}

assert.strictEqual(
  scripts.start,
  'node src/bootstrap/server.js',
  'Production start must boot the HTTP server directly'
)
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(scripts, 'prestart'),
  false,
  'Production start must not run database ensure scripts implicitly'
)
assert.ok(
  scripts['db:ensure-runtime-foundations'],
  'Database runtime foundation checks must remain available as an explicit deployment/maintenance command'
)

for (const requiredScript of [
  'db:ensure-device-intake',
  'db:ensure-input-tax-links',
  'db:ensure-supplier-payables',
  'db:ensure-supplier-payment-allocations',
  'db:ensure-supplier-advances',
  'db:ensure-supplier-disputes',
  'db:ensure-pos-held-carts',
]) {
  assert.ok(
    scripts['db:ensure-runtime-foundations'].includes(`npm run ${requiredScript}`),
    `Explicit runtime foundation command must retain ${requiredScript}`
  )
}

console.log('Startup Critical Path Contract: PASS')
