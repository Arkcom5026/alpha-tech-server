'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  createBuildSumatraPdfPrintCommandService,
} = require('../src/modules/storeDevice/print/adapters/windows/buildSumatraPdfPrintCommandService')

const readiness = Object.freeze({
  schemaVersion: 1,
  mode: 'DISCOVERY_ONLY',
  ready: true,
  selectedTransport: Object.freeze({
    code: 'SUMATRA_PDF',
    strategy: 'EXPLICIT_PRINTER_CLI',
    executablePath: 'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
  }),
})

const service = createBuildSumatraPdfPrintCommandService()
const plan = service.execute({
  readiness,
  printerName: 'EPSON L3210 Series',
  artifactFilePath: 'D:\\alpha-tech\\server\\.tmp-print-artifacts\\delivery-note.pdf',
  copies: 2,
})

assert.strictEqual(plan.mode, 'COMMAND_PLAN_ONLY')
assert.strictEqual(plan.physicalSideEffects, false)
assert.strictEqual(plan.executionEnabled, false)
assert.strictEqual(plan.transport.code, 'SUMATRA_PDF')
assert.strictEqual(plan.printer.name, 'EPSON L3210 Series')
assert.strictEqual(plan.command.shell, false)
assert.strictEqual(plan.command.executablePath, readiness.selectedTransport.executablePath)
assert.deepStrictEqual(plan.command.args, [
  '-silent',
  '-print-to',
  'EPSON L3210 Series',
  '-print-settings',
  '2x',
  'D:\\alpha-tech\\server\\.tmp-print-artifacts\\delivery-note.pdf',
])
assert.strictEqual(plan.safety.defaultPrinterFallbackAllowed, false)
assert.strictEqual(plan.safety.requiresExplicitPhysicalWriteApproval, true)

assert.throws(
  () => service.execute({ readiness, printerName: '', artifactFilePath: 'D:\\x.pdf' }),
  (error) => error.code === 'STORE_DEVICE_SUMATRA_PRINTER_REQUIRED',
)
assert.throws(
  () => service.execute({ readiness, printerName: 'EPSON', artifactFilePath: '.\\x.pdf' }),
  (error) => error.code === 'STORE_DEVICE_SUMATRA_PDF_PATH_INVALID',
)
assert.throws(
  () => service.execute({ readiness: { ...readiness, ready: false }, printerName: 'EPSON', artifactFilePath: 'D:\\x.pdf' }),
  (error) => error.code === 'STORE_DEVICE_SUMATRA_PDF_TRANSPORT_NOT_READY',
)

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'modules', 'storeDevice', 'print', 'adapters', 'windows', 'buildSumatraPdfPrintCommandService.js'),
  'utf8',
)
assert.doesNotMatch(source, /child_process|exec\(|execFile\(|spawn\(|Start-Process|WinSpool|prisma/i)
assert.match(source, /shell:\s*false/)
assert.match(source, /defaultPrinterFallbackAllowed:\s*false/)

console.log('store-device-sumatra-pdf-command-builder.contract.test.js: PASS')
