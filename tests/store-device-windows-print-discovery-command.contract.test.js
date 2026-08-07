'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(
  path.join(__dirname, '../scripts/inspect-windows-print-discovery.js'),
  'utf8',
)

assert.match(source, /READ_ONLY_WINDOWS_PRINT_DISCOVERY/)
assert.match(source, /physicalSideEffects:\s*false/)
assert.match(source, /collectWindowsPrintDiscoverySnapshot/)
assert.match(source, /createInspectWindowsPrintAdapterReadinessService/)
assert.match(source, /--printer=/)
assert.match(source, /process\.exitCode\s*=\s*readiness\.ready\s*\?\s*0\s*:\s*2/)

for (const forbidden of [
  /Set-Printer/i,
  /Add-Printer/i,
  /Remove-Printer/i,
  /Out-Printer/i,
  /winspool/i,
  /prisma/i,
]) {
  assert.doesNotMatch(source, forbidden)
}

console.log('store-device-windows-print-discovery-command.contract.test.js: PASS')
