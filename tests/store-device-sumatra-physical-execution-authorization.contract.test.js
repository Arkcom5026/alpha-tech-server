'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  APPROVAL_TOKEN,
  createAuthorizeSumatraPdfPhysicalExecutionService,
} = require('../src/modules/storeDevice/print/adapters/windows/authorizeSumatraPdfPhysicalExecutionService')

const servicePath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'storeDevice',
  'print',
  'adapters',
  'windows',
  'authorizeSumatraPdfPhysicalExecutionService.js',
)
const source = fs.readFileSync(servicePath, 'utf8')
assert.doesNotMatch(source, /child_process|exec\(|execFile\(|spawn\(|Start-Process|WinSpool|prisma/i)

const commandPlan = Object.freeze({
  schemaVersion: 1,
  mode: 'COMMAND_PLAN_ONLY',
  physicalSideEffects: false,
  executionEnabled: false,
  transport: Object.freeze({
    code: 'SUMATRA_PDF',
    strategy: 'EXPLICIT_PRINTER_CLI',
    executablePath: 'C:\\Users\\Administrator\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe',
  }),
  printer: Object.freeze({ name: 'EPSON L3210 Series' }),
  artifact: Object.freeze({
    filePath: 'D:\\alpha-tech\\server\\.tmp-print-artifacts\\document.pdf',
    mediaType: 'application/pdf',
  }),
  print: Object.freeze({ copies: 1 }),
  command: Object.freeze({
    executablePath: 'C:\\Users\\Administrator\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe',
    args: Object.freeze([
      '-silent',
      '-print-to',
      'EPSON L3210 Series',
      'D:\\alpha-tech\\server\\.tmp-print-artifacts\\document.pdf',
    ]),
    shell: false,
  }),
})

const service = createAuthorizeSumatraPdfPhysicalExecutionService()

assert.throws(
  () => service.execute({
    commandPlan,
    approvalToken: 'WRONG',
    expectedPrinterName: 'EPSON L3210 Series',
  }),
  (error) => error.code === 'STORE_DEVICE_SUMATRA_PHYSICAL_APPROVAL_REQUIRED',
)

assert.throws(
  () => service.execute({
    commandPlan,
    approvalToken: APPROVAL_TOKEN,
    expectedPrinterName: 'Other Printer',
  }),
  (error) => error.code === 'STORE_DEVICE_SUMATRA_PRINTER_AUTHORITY_MISMATCH',
)

const authorized = service.execute({
  commandPlan,
  approvalToken: APPROVAL_TOKEN,
  expectedPrinterName: 'EPSON L3210 Series',
})

assert.strictEqual(authorized.mode, 'PHYSICAL_EXECUTION_AUTHORIZED')
assert.strictEqual(authorized.physicalSideEffects, false)
assert.strictEqual(authorized.executionEnabled, false)
assert.strictEqual(authorized.authorization.explicitApprovalVerified, true)
assert.strictEqual(authorized.authorization.exactPrinterMatchVerified, true)
assert.strictEqual(authorized.authorization.executorRequired, true)
assert.strictEqual(authorized.safety.processExecutionPerformed, false)
assert.strictEqual(authorized.safety.spoolSubmissionPerformed, false)
assert.strictEqual(authorized.command.shell, false)
assert.strictEqual(authorized.printer.name, 'EPSON L3210 Series')

console.log('store-device-sumatra-physical-execution-authorization.contract.test.js: PASS')
