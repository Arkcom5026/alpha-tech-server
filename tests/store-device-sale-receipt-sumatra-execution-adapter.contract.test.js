'use strict'

const assert = require('assert')
const {
  createSaleReceiptSumatraPrintExecutionAdapter,
} = require('../src/modules/storeDevice/print/adapters/windows/saleReceiptSumatraPrintExecutionAdapter')

const executionEnvelope = Object.freeze({
  schemaVersion: 1,
  job: Object.freeze({ jobId: 'sdj_sale_receipt_sumatra_101', jobType: 'PRINT_DOCUMENT' }),
  lease: Object.freeze({ leaseId: 'sdl_sale_receipt_sumatra_202' }),
  documentPurpose: Object.freeze({ code: 'SALE_RECEIPT', displayName: 'ใบเสร็จรับเงิน' }),
  source: Object.freeze({ type: 'PAYMENT', id: 638 }),
  print: Object.freeze({ copies: 1 }),
  projection: Object.freeze({ document: Object.freeze({ title: 'ใบเสร็จรับเงิน' }) }),
})

async function main() {
  const authorizationCalls = []
  const executorCalls = []
  const nowValues = [1000, 1025]

  const adapter = createSaleReceiptSumatraPrintExecutionAdapter({
    now: () => nowValues.shift(),
    authorizationRuntimeService: Object.freeze({
      async execute(input) {
        authorizationCalls.push(input)
        return Object.freeze({
          authorization: Object.freeze({
            printer: Object.freeze({ name: 'EPSON TM-T82X' }),
          }),
        })
      },
    }),
    physicalExecutor: Object.freeze({
      async execute(input) {
        executorCalls.push(input)
        return Object.freeze({
          schemaVersion: 1,
          mode: 'PHYSICAL_EXECUTION_SUBMITTED',
          physicalSideEffects: true,
          executionEnabled: true,
          transport: Object.freeze({
            code: 'SUMATRA_PDF',
            strategy: 'EXPLICIT_PRINTER_CLI',
          }),
          printer: Object.freeze({ name: 'EPSON TM-T82X' }),
          artifact: Object.freeze({
            filePath: 'C:\\Temp\\receipt.pdf',
            mediaType: 'application/pdf',
          }),
          result: Object.freeze({ submitted: true }),
        })
      },
    }),
  })

  assert.strictEqual(adapter.supports(executionEnvelope), true)
  assert.strictEqual(adapter.capabilities().adapter, 'SALE_RECEIPT_SUMATRA')
  assert.strictEqual(adapter.capabilities().physicalSideEffects, true)
  assert.strictEqual(
    adapter.capabilities().resultSemantics,
    'SUBMISSION_CONFIRMED_NOT_PHYSICAL_OUTPUT_CONFIRMED',
  )

  const result = await adapter.execute(executionEnvelope, {
    readiness: Object.freeze({ adapterCode: 'WINDOWS_SPOOLER' }),
    approvalToken: 'ALPHATECH_SUMATRA_PDF_PHYSICAL_PRINT',
    expectedPrinterName: 'EPSON TM-T82X',
  })

  assert.strictEqual(authorizationCalls.length, 1)
  assert.strictEqual(authorizationCalls[0].executionEnvelope, executionEnvelope)
  assert.strictEqual(authorizationCalls[0].expectedPrinterName, 'EPSON TM-T82X')
  assert.strictEqual(executorCalls.length, 1)
  assert.strictEqual(executorCalls[0].authorization.printer.name, 'EPSON TM-T82X')

  assert.strictEqual(result.schemaVersion, 1)
  assert.strictEqual(result.adapter, 'SALE_RECEIPT_SUMATRA')
  assert.strictEqual(result.status, 'SUCCEEDED')
  assert.strictEqual(result.durationMs, 25)
  assert.strictEqual(result.evidence.meaning, 'PRINT_SUBMISSION_ACCEPTED')
  assert.strictEqual(result.evidence.submissionAccepted, true)
  assert.strictEqual(result.evidence.physicalOutputConfirmed, false)
  assert.strictEqual(result.evidence.printer.name, 'EPSON TM-T82X')
  assert.strictEqual(result.evidence.transport.code, 'SUMATRA_PDF')

  const deliveryEnvelope = Object.freeze({
    ...executionEnvelope,
    documentPurpose: Object.freeze({ code: 'DELIVERY_NOTE', displayName: 'ใบส่งสินค้า' }),
  })
  assert.strictEqual(adapter.supports(deliveryEnvelope), false)
  await assert.rejects(
    () => adapter.execute(deliveryEnvelope),
    (error) => error.code === 'STORE_DEVICE_SALE_RECEIPT_SUMATRA_PURPOSE_UNSUPPORTED',
  )

  const invalidSubmissionAdapter = createSaleReceiptSumatraPrintExecutionAdapter({
    authorizationRuntimeService: Object.freeze({
      async execute() {
        return Object.freeze({
          authorization: Object.freeze({
            printer: Object.freeze({ name: 'EPSON TM-T82X' }),
          }),
        })
      },
    }),
    physicalExecutor: Object.freeze({
      async execute() {
        return Object.freeze({
          schemaVersion: 1,
          mode: 'PHYSICAL_EXECUTION_SUBMITTED',
          physicalSideEffects: true,
          executionEnabled: true,
          printer: Object.freeze({ name: 'EPSON TM-T82X' }),
          result: Object.freeze({ submitted: false }),
        })
      },
    }),
  })

  await assert.rejects(
    () => invalidSubmissionAdapter.execute(executionEnvelope),
    (error) => error.code === 'STORE_DEVICE_SALE_RECEIPT_SUMATRA_SUBMISSION_INVALID',
  )

  const cancellation = await adapter.cancel(executionEnvelope)
  assert.strictEqual(cancellation.cancelled, false)
  assert.strictEqual(cancellation.cancellationSupported, false)
  assert.strictEqual(cancellation.physicalSideEffects, false)

  console.log('store-device-sale-receipt-sumatra-execution-adapter.contract.test.js: PASS')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
