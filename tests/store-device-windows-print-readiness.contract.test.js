'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const {
  createInspectWindowsPrintAdapterReadinessService,
} = require('../src/modules/storeDevice/print/adapters/windows/inspectWindowsPrintAdapterReadinessService')

const source = fs.readFileSync(
  path.join(
    __dirname,
    '../src/modules/storeDevice/print/adapters/windows/inspectWindowsPrintAdapterReadinessService.js',
  ),
  'utf8',
)

const service = createInspectWindowsPrintAdapterReadinessService()

const ready = service.execute({
  discoverySnapshot: {
    platform: 'win32',
    architecture: 'x64',
    spoolerAvailable: true,
    selectedPrinterName: 'Office Printer',
    printers: [
      { name: 'Office Printer', isDefault: false, isOnline: true },
      { name: 'Backup Printer', isDefault: true, isOnline: true },
    ],
  },
})

assert.equal(ready.adapterCode, 'WINDOWS_SPOOLER')
assert.equal(ready.mode, 'DISCOVERY_ONLY')
assert.equal(ready.physicalSideEffects, false)
assert.equal(ready.ready, true)
assert.deepEqual(ready.reasons, [])
assert.equal(ready.selectedPrinter.name, 'Office Printer')
assert.equal(ready.capability.printerCount, 2)
assert(Object.isFrozen(ready))

const missingSpooler = service.execute({
  discoverySnapshot: {
    platform: 'win32',
    spoolerAvailable: false,
    printers: [{ name: 'Office Printer', isDefault: true, isOnline: true }],
  },
})
assert.equal(missingSpooler.ready, false)
assert(missingSpooler.reasons.includes('WINDOWS_SPOOLER_UNAVAILABLE'))

const noPrinters = service.execute({
  discoverySnapshot: {
    platform: 'win32',
    spoolerAvailable: true,
    printers: [],
  },
})
assert.equal(noPrinters.ready, false)
assert(noPrinters.reasons.includes('WINDOWS_PRINTERS_NOT_DISCOVERED'))

const wrongPlatform = service.execute({
  discoverySnapshot: {
    platform: 'linux',
    spoolerAvailable: true,
    printers: [{ name: 'Printer', isDefault: true, isOnline: true }],
  },
})
assert.equal(wrongPlatform.ready, false)
assert(wrongPlatform.reasons.includes('WINDOWS_PLATFORM_REQUIRED'))

const offline = service.execute({
  discoverySnapshot: {
    platform: 'win32',
    spoolerAvailable: true,
    printers: [{ name: 'Printer', isDefault: true, isOnline: false }],
  },
})
assert.equal(offline.ready, false)
assert(offline.reasons.includes('WINDOWS_PRINTER_OFFLINE'))

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
    `readiness inspection must remain discovery-only: ${forbidden}`,
  )
}

console.log('store-device-windows-print-readiness.contract.test.js: PASS')
