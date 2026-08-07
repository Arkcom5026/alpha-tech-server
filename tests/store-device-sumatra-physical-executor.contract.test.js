'use strict'

const assert = require('assert')
const {
  createExecuteAuthorizedSumatraPdfPhysicalPrintService,
} = require('../src/modules/storeDevice/print/adapters/windows/executeAuthorizedSumatraPdfPhysicalPrintService')

const authorization = Object.freeze({
  schemaVersion: 1,
  mode: 'PHYSICAL_EXECUTION_AUTHORIZED',
  physicalSideEffects: false,
  executionEnabled: false,
  transport: Object.freeze({
    code: 'SUMATRA_PDF',
    strategy: 'EXPLICIT_PRINTER_CLI',
    executablePath: 'C:\\Users\\Administrator\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe',
  }),
  printer: Object.freeze({ name: 'EPSON L3210 Series' }),
  artifact: Object.freeze({
    filePath: 'D:\\alpha-tech\\server\\.tmp-print-artifacts\\windows-browser-thai-smoke.pdf',
    mediaType: 'application/pdf',
  }),
  print: Object.freeze({ copies: 1 }),
  command: Object.freeze({
    executablePath: 'C:\\Users\\Administrator\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe',
    args: Object.freeze([
      '-silent',
      '-print-to',
      'EPSON L3210 Series',
      'D:\\alpha-tech\\server\\.tmp-print-artifacts\\windows-browser-thai-smoke.pdf',
    ]),
    shell: false,
  }),
  authorization: Object.freeze({
    explicitApprovalVerified: true,
    exactPrinterMatchVerified: true,
    executorRequired: true,
  }),
  safety: Object.freeze({
    processExecutionPerformed: false,
    spoolSubmissionPerformed: false,
    requiresDedicatedPhysicalExecutor: true,
  }),
})

async function main() {
  const calls = []
  const fakeExecFile = (executablePath, args, options, callback) => {
    calls.push({ executablePath, args, options })
    callback(null, 'submitted', '')
  }

  const service = createExecuteAuthorizedSumatraPdfPhysicalPrintService({
    execFile: fakeExecFile,
    timeoutMs: 12345,
  })

  const result = await service.execute({ authorization })

  assert.strictEqual(calls.length, 1)
  assert.strictEqual(calls[0].executablePath, authorization.command.executablePath)
  assert.deepStrictEqual(calls[0].args, authorization.command.args)
  assert.strictEqual(calls[0].options.shell, false)
  assert.strictEqual(calls[0].options.windowsHide, true)
  assert.strictEqual(calls[0].options.timeout, 12345)

  assert.strictEqual(result.mode, 'PHYSICAL_EXECUTION_SUBMITTED')
  assert.strictEqual(result.physicalSideEffects, true)
  assert.strictEqual(result.executionEnabled, true)
  assert.strictEqual(result.printer.name, 'EPSON L3210 Series')
  assert.strictEqual(result.result.submitted, true)
  assert.strictEqual(result.result.stdout, 'submitted')
  assert.strictEqual(result.safety.explicitApprovalVerified, true)
  assert.strictEqual(result.safety.exactPrinterMatchVerified, true)
  assert.strictEqual(result.safety.processExecutionPerformed, true)
  assert.strictEqual(result.safety.spoolSubmissionAttempted, true)

  await assert.rejects(
    () => service.execute({ authorization: { ...authorization, mode: 'COMMAND_PLAN_ONLY' } }),
    (error) => error.code === 'STORE_DEVICE_SUMATRA_PHYSICAL_AUTHORIZATION_REQUIRED',
  )

  const failingService = createExecuteAuthorizedSumatraPdfPhysicalPrintService({
    execFile: (_exe, _args, _options, callback) => {
      const error = Object.assign(new Error('print failed'), { code: 7 })
      callback(error, '', 'printer error')
    },
  })

  await assert.rejects(
    () => failingService.execute({ authorization }),
    (error) => (
      error.code === 'STORE_DEVICE_SUMATRA_PHYSICAL_EXECUTION_FAILED'
      && error.statusCode === 502
      && error.detail?.exitCode === 7
      && error.detail?.stderr === 'printer error'
    ),
  )

  console.log('store-device-sumatra-physical-executor.contract.test.js: PASS')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
