'use strict'

const assert = require('node:assert/strict')
const {
  createResolvePrintExecutionAdapterService,
} = require('../src/modules/storeDevice/print/resolvePrintExecutionAdapterService')
const {
  createExecutePrintDocumentLeaseService,
} = require('../src/modules/storeDevice/print/executePrintDocumentLeaseService')

const envelope = Object.freeze({
  schemaVersion: 1,
  job: Object.freeze({ jobId: 'sdj_sumatra_runtime', jobType: 'PRINT_DOCUMENT' }),
  lease: Object.freeze({ leaseId: 'sdl_sumatra_runtime' }),
  documentPurpose: Object.freeze({ code: 'SALE_RECEIPT', displayName: 'ใบเสร็จรับเงิน' }),
  source: Object.freeze({ type: 'PAYMENT', id: 638 }),
  print: Object.freeze({ copies: 1 }),
  projection: Object.freeze({ document: Object.freeze({ type: 'SALE_RECEIPT' }) }),
})

const defaultResolver = createResolvePrintExecutionAdapterService()
const defaultResolved = defaultResolver.execute({ executionEnvelope: envelope })
assert.equal(defaultResolved.adapterCode, 'DRY_RUN')
assert.equal(defaultResolved.capabilities.dryRun, true)

const physicalResolved = defaultResolver.execute({
  executionEnvelope: envelope,
  adapterCode: 'SALE_RECEIPT_SUMATRA',
})
assert.equal(physicalResolved.adapterCode, 'SALE_RECEIPT_SUMATRA')
assert.equal(physicalResolved.capabilities.physicalSideEffects, true)
assert.equal(physicalResolved.capabilities.resultSemantics, 'SUBMISSION_CONFIRMED_NOT_PHYSICAL_OUTPUT_CONFIRMED')
assert.deepEqual(physicalResolved.capabilities.supportedDocumentPurposes, ['SALE_RECEIPT'])

const deliveryEnvelope = Object.freeze({
  ...envelope,
  documentPurpose: Object.freeze({ code: 'DELIVERY_NOTE', displayName: 'ใบส่งสินค้า' }),
})
assert.throws(
  () => defaultResolver.execute({
    executionEnvelope: deliveryEnvelope,
    adapterCode: 'SALE_RECEIPT_SUMATRA',
  }),
  (error) => error.code === 'STORE_DEVICE_PRINT_ADAPTER_UNSUPPORTED',
)

;(async () => {
  const calls = []
  const fakeAdapter = Object.freeze({
    name: 'SALE_RECEIPT_SUMATRA',
    supports() { return true },
    capabilities() {
      return Object.freeze({
        adapter: 'SALE_RECEIPT_SUMATRA',
        dryRun: false,
        physicalSideEffects: true,
        resultSemantics: 'SUBMISSION_CONFIRMED_NOT_PHYSICAL_OUTPUT_CONFIRMED',
      })
    },
    async execute(receivedEnvelope, options) {
      calls.push('EXECUTE')
      assert.equal(receivedEnvelope, envelope)
      assert.equal(options.approvalToken, 'test-approval')
      assert.equal(options.expectedPrinterName, 'TEST PRINTER')
      return Object.freeze({
        schemaVersion: 1,
        adapter: 'SALE_RECEIPT_SUMATRA',
        status: 'SUCCEEDED',
        durationMs: 4,
        evidence: Object.freeze({
          schemaVersion: 1,
          meaning: 'PRINT_SUBMISSION_ACCEPTED',
          physicalOutputConfirmed: false,
          processExecutionPerformed: true,
          spoolSubmissionAttempted: true,
          submissionAccepted: true,
          printer: Object.freeze({ name: 'TEST PRINTER' }),
          transport: Object.freeze({ code: 'SUMATRA_PDF', strategy: 'EXPLICIT_PRINTER_CLI' }),
        }),
        error: null,
      })
    },
    async cancel() { return Object.freeze({ cancelled: false }) },
  })

  const resolver = createResolvePrintExecutionAdapterService({
    adapters: Object.freeze({ SALE_RECEIPT_SUMATRA: fakeAdapter }),
  })

  const executionService = Object.freeze({
    async acknowledge(args) {
      calls.push('ACKNOWLEDGE')
      assert.equal(args.leaseId, envelope.lease.leaseId)
      assert.equal(args.payload.gatewayId, 'gw-runtime')
      assert.equal(args.payload.sessionId, 'sess-runtime')
    },
    async complete(args) {
      calls.push(`COMPLETE:${args.status}`)
      assert.equal(args.status, 'SUCCEEDED')
      assert.equal(args.payload.resultId, 'result-runtime')
      assert.equal(args.payload.executionSnapshot.adapter, 'SALE_RECEIPT_SUMATRA')
      assert.equal(args.payload.executionSnapshot.status, 'SUCCEEDED')
      assert.equal(args.payload.adapterEvidence.adapter, 'SALE_RECEIPT_SUMATRA')
      assert.equal(args.payload.adapterEvidence.capabilities.physicalSideEffects, true)
      assert.equal(args.payload.adapterEvidence.evidence.meaning, 'PRINT_SUBMISSION_ACCEPTED')
      assert.equal(args.payload.adapterEvidence.evidence.physicalOutputConfirmed, false)
      assert.equal(args.payload.errorMetadata, null)
      return Object.freeze({ result: Object.freeze({ status: 'SUCCEEDED' }) })
    },
  })

  const service = createExecutePrintDocumentLeaseService({ resolverService: resolver, executionService })
  const result = await service.execute({
    user: Object.freeze({ branchId: 2 }),
    executionEnvelope: envelope,
    gatewayId: 'gw-runtime',
    sessionId: 'sess-runtime',
    resultId: 'result-runtime',
    adapterCode: 'SALE_RECEIPT_SUMATRA',
    adapterOptions: Object.freeze({
      approvalToken: 'test-approval',
      expectedPrinterName: 'TEST PRINTER',
    }),
  })

  assert.deepEqual(calls, ['ACKNOWLEDGE', 'EXECUTE', 'COMPLETE:SUCCEEDED'])
  assert.equal(result.lifecycleStatus, 'SUCCEEDED')
  assert.equal(result.adapterCode, 'SALE_RECEIPT_SUMATRA')
  assert.equal(result.adapterResult.evidence.meaning, 'PRINT_SUBMISSION_ACCEPTED')
  assert.equal(result.adapterResult.evidence.physicalOutputConfirmed, false)

  console.log('store-device-sale-receipt-sumatra-runtime-registration.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
