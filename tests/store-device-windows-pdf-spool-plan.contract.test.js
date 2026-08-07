'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  createWindowsPdfSpoolPlanService,
} = require('../src/modules/storeDevice/print/adapters/windows/windowsPdfSpoolPlanService')

const artifact = Object.freeze({
  schemaVersion: 1,
  format: 'PDF',
  mediaType: 'application/pdf',
  renderer: 'WINDOWS_BROWSER_PDF',
  documentPurpose: Object.freeze({ code: 'DELIVERY_NOTE' }),
  source: Object.freeze({ type: 'SALE', id: 303 }),
  pageCount: 1,
  byteLength: 12,
  checksum: 'a'.repeat(64),
  payload: Object.freeze({
    encoding: 'base64',
    data: Buffer.from('%PDF-1.7\n').toString('base64'),
  }),
  physicalSideEffects: false,
})

const admission = Object.freeze({
  schemaVersion: 1,
  adapterCode: 'WINDOWS_SPOOLER',
  mode: 'ADMISSION_ONLY',
  physicalSideEffects: false,
  admitted: true,
  artifact,
  printer: Object.freeze({
    name: 'EPSON L3210 Series',
    driverName: 'Epson ESC/P-R V4 Class Driver',
    portName: 'USB001',
  }),
})

const service = createWindowsPdfSpoolPlanService()
const plan = service.execute({ admission, copies: 2 })

assert.strictEqual(plan.mode, 'PHYSICAL_EXECUTION_PLAN_ONLY')
assert.strictEqual(plan.physicalSideEffects, false)
assert.strictEqual(plan.executionEnabled, false)
assert.strictEqual(plan.transport.code, 'WINDOWS_PDF_TRANSPORT_UNRESOLVED')
assert.strictEqual(plan.transport.ready, false)
assert.strictEqual(plan.printer.name, 'EPSON L3210 Series')
assert.strictEqual(plan.print.copies, 2)
assert.strictEqual(plan.artifact.format, 'PDF')
assert.strictEqual(plan.artifact.checksum, artifact.checksum)
assert.strictEqual(plan.artifact.payloadEncoding, 'base64')
assert.strictEqual(plan.safety.requiresExplicitTransportReadiness, true)
assert.strictEqual(plan.safety.requiresExplicitPhysicalWriteApproval, true)
assert.strictEqual(plan.safety.requiresExactPrinterMatch, true)

assert.throws(
  () => service.execute({ admission: { ...admission, admitted: false } }),
  (error) => error.code === 'STORE_DEVICE_WINDOWS_PRINT_ADMISSION_REQUIRED',
)

assert.throws(
  () => service.execute({ admission, copies: 0 }),
  (error) => error.code === 'STORE_DEVICE_WINDOWS_PRINT_COPIES_INVALID',
)

const source = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'modules',
    'storeDevice',
    'print',
    'adapters',
    'windows',
    'windowsPdfSpoolPlanService.js',
  ),
  'utf8',
)

assert.doesNotMatch(source, /child_process|execFile|spawn|powershell|Start-Process|PrintTo|winspool|prisma/i)
assert.match(source, /PHYSICAL_EXECUTION_PLAN_ONLY/)
assert.match(source, /WINDOWS_PDF_TRANSPORT_UNRESOLVED/)
assert.match(source, /requiresExplicitPhysicalWriteApproval/)

console.log('store-device-windows-pdf-spool-plan.contract.test.js: PASS')
