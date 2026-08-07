'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  createPrepareSumatraPdfPhysicalSmokeService,
} = require('../src/modules/storeDevice/print/adapters/windows/prepareSumatraPdfPhysicalSmokeService')

const pdfPath = 'D:\\alpha-tech\\server\\.tmp-print-artifacts\\windows-browser-thai-smoke.pdf'
const readiness = Object.freeze({
  schemaVersion: 1,
  mode: 'DISCOVERY_ONLY',
  ready: true,
  selectedTransport: Object.freeze({
    code: 'SUMATRA_PDF',
    strategy: 'EXPLICIT_PRINTER_CLI',
    executablePath: 'C:\\Users\\Administrator\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe',
  }),
})
const printerReadiness = Object.freeze({
  schemaVersion: 1,
  adapterCode: 'WINDOWS_SPOOLER',
  mode: 'DISCOVERY_ONLY',
  ready: true,
  selectedPrinter: Object.freeze({
    name: 'EPSON L3210 Series',
    isOnline: true,
    driverName: 'Epson ESC/P-R V4 Class Driver',
    portName: 'USB001',
  }),
})

const service = createPrepareSumatraPdfPhysicalSmokeService({
  existsSync: (candidate) => candidate === pdfPath,
  readFileSync: () => Buffer.from('%PDF-1.7\nsmoke'),
})

const result = service.execute({
  transportReadiness: readiness,
  printerReadiness,
  artifactFilePath: pdfPath,
  printerName: 'EPSON L3210 Series',
  copies: 1,
})

assert.strictEqual(result.mode, 'PHYSICAL_SMOKE_READY_FOR_EXPLICIT_APPROVAL')
assert.strictEqual(result.physicalSideEffects, false)
assert.strictEqual(result.executionEnabled, false)
assert.strictEqual(result.ready, true)
assert.strictEqual(result.printer.name, 'EPSON L3210 Series')
assert.strictEqual(result.artifact.pdfHeader, '%PDF-')
assert.strictEqual(result.commandPlan.mode, 'COMMAND_PLAN_ONLY')
assert.strictEqual(result.commandPlan.command.shell, false)
assert.strictEqual(result.authorization.approvalRequired, true)
assert.strictEqual(result.authorization.approvalTokenEmbedded, false)
assert.strictEqual(result.authorization.executionPerformed, false)

assert.throws(
  () => service.execute({
    transportReadiness: readiness,
    printerReadiness,
    artifactFilePath: pdfPath,
    printerName: 'Other Printer',
  }),
  (error) => error.code === 'STORE_DEVICE_SUMATRA_PHYSICAL_SMOKE_PRINTER_MISMATCH',
)

assert.throws(
  () => createPrepareSumatraPdfPhysicalSmokeService({
    existsSync: () => false,
  }).execute({
    transportReadiness: readiness,
    printerReadiness,
    artifactFilePath: pdfPath,
    printerName: 'EPSON L3210 Series',
  }),
  (error) => error.code === 'STORE_DEVICE_SUMATRA_PHYSICAL_SMOKE_ARTIFACT_NOT_FOUND',
)

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'modules', 'storeDevice', 'print', 'adapters', 'windows', 'prepareSumatraPdfPhysicalSmokeService.js'),
  'utf8',
)
assert.doesNotMatch(source, /child_process|execFile\(|spawn\(|Start-Process|WinSpool|prisma/i)

console.log('store-device-sumatra-physical-smoke-readiness.contract.test.js: PASS')
