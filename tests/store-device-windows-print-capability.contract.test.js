'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const {
  assertWindowsDiscoverySnapshot,
} = require('../src/modules/storeDevice/print/adapters/windows/windowsPrintCapabilityContract')

const source = fs.readFileSync(
  path.join(
    __dirname,
    '../src/modules/storeDevice/print/adapters/windows/windowsPrintCapabilityContract.js',
  ),
  'utf8',
)

const snapshot = assertWindowsDiscoverySnapshot({
  platform: 'win32',
  architecture: 'x64',
  spoolerAvailable: true,
  selectedPrinterName: 'Receipt Printer',
  printers: [
    {
      name: 'Receipt Printer',
      isDefault: true,
      isOnline: true,
      driverName: 'Certified Driver',
      portName: 'USB001',
    },
  ],
})

assert.equal(snapshot.schemaVersion, 1)
assert.equal(snapshot.platform, 'win32')
assert.equal(snapshot.spoolerAvailable, true)
assert.equal(snapshot.printers.length, 1)
assert.equal(snapshot.printers[0].name, 'Receipt Printer')
assert.equal(snapshot.printers[0].isOnline, true)
assert(Object.isFrozen(snapshot))
assert(Object.isFrozen(snapshot.printers))
assert(Object.isFrozen(snapshot.printers[0]))

assert.throws(
  () => assertWindowsDiscoverySnapshot({ platform: '', printers: [] }),
  (error) => error.code === 'STORE_DEVICE_WINDOWS_PRINT_PLATFORM_REQUIRED',
)

for (const forbidden of [
  'child_process',
  'exec(',
  'spawn(',
  'powershell',
  'winspool',
  'prisma.',
  '$executeRaw',
  '$queryRaw',
]) {
  assert.equal(
    source.toLowerCase().includes(forbidden.toLowerCase()),
    false,
    `capability contract must remain side-effect free: ${forbidden}`,
  )
}

console.log('store-device-windows-print-capability.contract.test.js: PASS')
