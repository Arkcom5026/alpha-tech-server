'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const {
  DISCOVERY_SCRIPT,
  parsePowerShellDiscoveryOutput,
} = require('../src/modules/storeDevice/print/adapters/windows/collectWindowsPrintDiscoverySnapshot')

const fixture = JSON.stringify({
  schemaVersion: 1,
  platform: 'win32',
  architecture: 'AMD64',
  spoolerAvailable: true,
  printers: [
    {
      name: 'Receipt Printer',
      isDefault: true,
      isOnline: true,
      driverName: 'Generic Driver',
      portName: 'USB001',
    },
  ],
})

const snapshot = parsePowerShellDiscoveryOutput(fixture)
assert.equal(snapshot.platform, 'win32')
assert.equal(snapshot.spoolerAvailable, true)
assert.equal(snapshot.printers.length, 1)
assert.equal(snapshot.printers[0].name, 'Receipt Printer')
assert.equal(snapshot.printers[0].isDefault, true)

assert.match(DISCOVERY_SCRIPT, /Get-Service\s+-Name\s+Spooler/)
assert.match(DISCOVERY_SCRIPT, /Get-Printer/)
assert.match(DISCOVERY_SCRIPT, /ConvertTo-Json/)

for (const forbidden of [
  /Set-Printer/i,
  /Add-Printer/i,
  /Remove-Printer/i,
  /Restart-Service/i,
  /Start-Service/i,
  /Stop-Service/i,
  /Out-Printer/i,
  /Start-Process/i,
]) {
  assert.doesNotMatch(DISCOVERY_SCRIPT, forbidden)
}

const source = fs.readFileSync(
  path.join(
    __dirname,
    '../src/modules/storeDevice/print/adapters/windows/collectWindowsPrintDiscoverySnapshot.js',
  ),
  'utf8',
)

assert.match(source, /execFileSync/)
assert.match(source, /powershell\.exe/)
assert.doesNotMatch(source, /execSync\s*\(/)
assert.doesNotMatch(source, /spawn\s*\(/)
assert.doesNotMatch(source, /prisma/i)
assert.doesNotMatch(source, /\$executeRaw/)

console.log('store-device-windows-print-discovery-collector.contract.test.js: PASS')
