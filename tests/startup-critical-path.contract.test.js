'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = process.cwd()
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const scripts = packageJson.scripts || {}
const verifier = fs.readFileSync(
  path.join(root, 'scripts/verify-runtime-foundations-readonly.js'),
  'utf8'
)

assert.strictEqual(
  scripts.start,
  'node scripts/verify-runtime-foundations-readonly.js && node src/bootstrap/server.js',
  'Production start must run one read-only foundation verification before booting the HTTP server'
)
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(scripts, 'prestart'),
  false,
  'Production start must not run database mutation hooks implicitly'
)
assert.ok(
  scripts['db:ensure-runtime-foundations'],
  'Database mutation checks must remain available as an explicit deployment/maintenance command'
)
assert.ok(verifier.includes("const { Client } = require('pg')"))
assert.ok(verifier.includes('to_regclass'))
assert.ok(verifier.includes('Runtime foundation read-only verification is ready'))
assert.ok(!verifier.includes('CREATE TABLE'))
assert.ok(!verifier.includes('ALTER TABLE'))
assert.ok(!verifier.includes('CREATE INDEX'))

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
