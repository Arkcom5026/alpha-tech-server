'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const {
  createPrintRenderArtifact,
} = require('../src/modules/storeDevice/print/render/printRenderArtifactContract')
const {
  createAdmitWindowsPrintArtifactService,
  WINDOWS_ADMITTED_FORMATS,
} = require('../src/modules/storeDevice/print/adapters/windows/admitWindowsPrintArtifactService')

const service = createAdmitWindowsPrintArtifactService()
const readiness = Object.freeze({
  schemaVersion: 1,
  adapterCode: 'WINDOWS_SPOOLER',
  ready: true,
  reasons: Object.freeze([]),
  selectedPrinter: Object.freeze({
    name: 'EPSON L3210 Series',
    isOnline: true,
    driverName: 'Epson ESC/P-R V4 Class Driver',
    portName: 'USB001',
  }),
})

const artifact = createPrintRenderArtifact({
  format: 'PDF',
  mediaType: 'application/pdf',
  renderer: 'TEST_PDF_RENDERER',
  documentPurpose: { code: 'DELIVERY_NOTE', displayName: 'Delivery Note' },
  source: { type: 'SALE', id: 10 },
  pageCount: 1,
  byteLength: 100,
  checksum: 'sha256:test',
  payload: { uri: 'memory://test.pdf' },
  physicalSideEffects: false,
})

const admitted = service.execute({ artifact, readiness })
assert.strictEqual(admitted.admitted, true)
assert.strictEqual(admitted.mode, 'ADMISSION_ONLY')
assert.strictEqual(admitted.physicalSideEffects, false)
assert.strictEqual(admitted.printer.name, 'EPSON L3210 Series')
assert.deepStrictEqual(WINDOWS_ADMITTED_FORMATS, ['PDF', 'XPS', 'EMF'])

const dryRunArtifact = createPrintRenderArtifact({
  format: 'DRY_RUN_MANIFEST',
  mediaType: 'application/json',
  renderer: 'DRY_RUN',
  documentPurpose: { code: 'DELIVERY_NOTE' },
  source: { type: 'SALE', id: 10 },
  pageCount: 1,
})

assert.throws(
  () => service.execute({ artifact: dryRunArtifact, readiness }),
  (error) => error?.code === 'STORE_DEVICE_WINDOWS_PRINT_ARTIFACT_FORMAT_UNSUPPORTED'
    && error?.statusCode === 409,
)

assert.throws(
  () => service.execute({
    artifact,
    readiness: { ...readiness, ready: false, reasons: ['WINDOWS_PRINTER_OFFLINE'] },
  }),
  (error) => error?.code === 'STORE_DEVICE_WINDOWS_PRINT_NOT_READY',
)

const source = fs.readFileSync(
  path.join(
    __dirname,
    '../src/modules/storeDevice/print/adapters/windows/admitWindowsPrintArtifactService.js',
  ),
  'utf8',
)
for (const forbidden of [
  'child_process',
  'powershell',
  'Get-Printer',
  'Start-Process',
  'winspool',
  'prisma',
]) {
  assert.strictEqual(source.toLowerCase().includes(forbidden.toLowerCase()), false)
}

console.log('store-device-windows-print-artifact-admission.contract.test.js: PASS')
