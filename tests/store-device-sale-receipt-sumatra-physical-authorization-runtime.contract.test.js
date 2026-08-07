'use strict'

const assert = require('assert')
const {
  APPROVAL_TOKEN,
} = require('../src/modules/storeDevice/print/adapters/windows/authorizeSumatraPdfPhysicalExecutionService')
const {
  createSaleReceiptSumatraPhysicalAuthorizationRuntimeService,
} = require('../src/modules/storeDevice/print/adapters/windows/createSaleReceiptSumatraPhysicalAuthorizationRuntimeService')

const executionEnvelope = Object.freeze({
  schemaVersion: 1,
  job: Object.freeze({ jobId: 'sdj_sale_receipt_auth_101', jobType: 'PRINT_DOCUMENT' }),
  lease: Object.freeze({ leaseId: 'sdl_sale_receipt_auth_202' }),
  documentPurpose: Object.freeze({ code: 'SALE_RECEIPT', displayName: 'ใบเสร็จรับเงิน' }),
  source: Object.freeze({ type: 'PAYMENT', id: 638 }),
  print: Object.freeze({ copies: 1 }),
  projection: Object.freeze({ document: Object.freeze({ id: 638 }) }),
})

const planned = Object.freeze({
  schemaVersion: 1,
  mode: 'SALE_RECEIPT_SUMATRA_PDF_COMMAND_PLAN',
  physicalSideEffects: false,
  filesystemSideEffects: true,
  executionEnabled: false,
  spoolPlanning: Object.freeze({
    spoolPlan: Object.freeze({
      printer: Object.freeze({ name: 'EPSON L3210 Series' }),
      artifact: Object.freeze({ checksum: 'a'.repeat(64) }),
    }),
  }),
  commandPlan: Object.freeze({
    schemaVersion: 1,
    mode: 'COMMAND_PLAN_ONLY',
    physicalSideEffects: false,
    executionEnabled: false,
    transport: Object.freeze({
      code: 'SUMATRA_PDF',
      strategy: 'EXPLICIT_PRINTER_CLI',
      executablePath: 'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
    }),
    printer: Object.freeze({ name: 'EPSON L3210 Series' }),
    artifact: Object.freeze({
      filePath: 'C:\\Temp\\alpha-tech\\receipt.pdf',
      mediaType: 'application/pdf',
    }),
    print: Object.freeze({ copies: 1 }),
    command: Object.freeze({
      executablePath: 'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
      args: Object.freeze([
        '-silent',
        '-print-to',
        'EPSON L3210 Series',
        'C:\\Temp\\alpha-tech\\receipt.pdf',
      ]),
      shell: false,
    }),
  }),
})

async function main() {
  let commandPlanCalls = 0
  const commandPlanRuntimeService = Object.freeze({
    async execute({ executionEnvelope: receivedEnvelope, readiness }) {
      commandPlanCalls += 1
      assert.strictEqual(receivedEnvelope, executionEnvelope)
      assert.deepStrictEqual(readiness, { adapterCode: 'WINDOWS_SPOOLER', ready: true })
      return planned
    },
  })

  const service = createSaleReceiptSumatraPhysicalAuthorizationRuntimeService({
    commandPlanRuntimeService,
  })

  const result = await service.execute({
    executionEnvelope,
    readiness: { adapterCode: 'WINDOWS_SPOOLER', ready: true },
    approvalToken: APPROVAL_TOKEN,
    expectedPrinterName: 'EPSON L3210 Series',
  })

  assert.strictEqual(commandPlanCalls, 1)
  assert.strictEqual(result.mode, 'SALE_RECEIPT_SUMATRA_PHYSICAL_AUTHORIZED')
  assert.strictEqual(result.physicalSideEffects, false)
  assert.strictEqual(result.executionEnabled, false)
  assert.strictEqual(result.authorization.mode, 'PHYSICAL_EXECUTION_AUTHORIZED')
  assert.strictEqual(result.authorization.printer.name, 'EPSON L3210 Series')
  assert.strictEqual(result.authorization.authorization.explicitApprovalVerified, true)
  assert.strictEqual(result.authorization.authorization.exactPrinterMatchVerified, true)
  assert.strictEqual(result.safety.processExecutionPerformed, false)
  assert.strictEqual(result.safety.spoolSubmissionPerformed, false)
  assert.strictEqual(result.safety.requiresDedicatedPhysicalExecutor, true)

  await assert.rejects(
    () => service.execute({
      executionEnvelope,
      readiness: { adapterCode: 'WINDOWS_SPOOLER', ready: true },
      approvalToken: 'WRONG',
      expectedPrinterName: 'EPSON L3210 Series',
    }),
    (error) => error.code === 'STORE_DEVICE_SUMATRA_PHYSICAL_APPROVAL_REQUIRED',
  )

  await assert.rejects(
    () => service.execute({
      executionEnvelope,
      readiness: { adapterCode: 'WINDOWS_SPOOLER', ready: true },
      approvalToken: APPROVAL_TOKEN,
      expectedPrinterName: 'Other Printer',
    }),
    (error) => error.code === 'STORE_DEVICE_SUMATRA_PRINTER_AUTHORITY_MISMATCH',
  )

  const mismatchedPlanService = createSaleReceiptSumatraPhysicalAuthorizationRuntimeService({
    commandPlanRuntimeService: Object.freeze({
      async execute() {
        return Object.freeze({
          ...planned,
          commandPlan: Object.freeze({
            ...planned.commandPlan,
            printer: Object.freeze({ name: 'Other Printer' }),
          }),
        })
      },
    }),
  })

  await assert.rejects(
    () => mismatchedPlanService.execute({
      executionEnvelope,
      readiness: { adapterCode: 'WINDOWS_SPOOLER', ready: true },
      approvalToken: APPROVAL_TOKEN,
      expectedPrinterName: 'EPSON L3210 Series',
    }),
    (error) => error.code === 'STORE_DEVICE_SALE_RECEIPT_SUMATRA_PRINTER_PLAN_MISMATCH',
  )

  console.log('store-device-sale-receipt-sumatra-physical-authorization-runtime.contract.test.js: PASS')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
