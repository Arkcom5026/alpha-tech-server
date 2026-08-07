'use strict'

const assert = require('assert')
const {
  createPrintRenderArtifact,
} = require('../src/modules/storeDevice/print/render/printRenderArtifactContract')
const {
  createStoreDevicePrintRenderRuntimeService,
} = require('../src/modules/storeDevice/print/render/createStoreDevicePrintRenderRuntimeService')
const {
  createSaleReceiptWindowsPdfSpoolPlanRuntimeService,
} = require('../src/modules/storeDevice/print/adapters/windows/createSaleReceiptWindowsPdfSpoolPlanRuntimeService')

const executionEnvelope = Object.freeze({
  schemaVersion: 1,
  job: Object.freeze({ jobId: 'sdj_sale_runtime_101', jobType: 'PRINT_DOCUMENT' }),
  lease: Object.freeze({ leaseId: 'sdl_sale_runtime_202' }),
  documentPurpose: Object.freeze({ code: 'SALE_RECEIPT', displayName: 'ใบเสร็จรับเงิน' }),
  source: Object.freeze({ type: 'PAYMENT', id: 638 }),
  print: Object.freeze({ copies: 2 }),
  projection: Object.freeze({ document: Object.freeze({ title: 'ใบเสร็จรับเงิน' }) }),
})

const artifact = createPrintRenderArtifact({
  format: 'PDF',
  mediaType: 'application/pdf',
  renderer: 'WINDOWS_BROWSER_PDF',
  documentPurpose: executionEnvelope.documentPurpose,
  source: executionEnvelope.source,
  pageCount: 1,
  byteLength: 24,
  checksum: 'sha256:sale-receipt-runtime-test',
  payload: Object.freeze({
    encoding: 'base64',
    data: Buffer.from('%PDF-1.7\nsale-receipt\n').toString('base64'),
  }),
})

const rendererCalls = []
const renderRuntimeService = createStoreDevicePrintRenderRuntimeService({
  saleReceiptRenderer: Object.freeze({
    async execute({ executionEnvelope: receivedEnvelope }) {
      rendererCalls.push(receivedEnvelope)
      return artifact
    },
  }),
})

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

async function main() {
  const service = createSaleReceiptWindowsPdfSpoolPlanRuntimeService({
    renderRuntimeService,
  })

  const result = await service.execute({ executionEnvelope, readiness })

  assert.strictEqual(rendererCalls.length, 1)
  assert.strictEqual(rendererCalls[0], executionEnvelope)
  assert.strictEqual(result.schemaVersion, 1)
  assert.strictEqual(result.mode, 'SALE_RECEIPT_WINDOWS_PDF_SPOOL_PLAN')
  assert.strictEqual(result.physicalSideEffects, false)
  assert.strictEqual(result.executionEnabled, false)
  assert.strictEqual(result.documentPurpose.code, 'SALE_RECEIPT')
  assert.strictEqual(result.source.type, 'PAYMENT')
  assert.strictEqual(result.source.id, 638)
  assert.strictEqual(result.render.purposeCode, 'SALE_RECEIPT')
  assert.strictEqual(result.render.format, 'SALE_RECEIPT_80MM_PDF')
  assert.strictEqual(result.render.artifact, artifact)
  assert.strictEqual(result.admission.admitted, true)
  assert.strictEqual(result.admission.printer.name, 'EPSON L3210 Series')
  assert.strictEqual(result.spoolPlan.mode, 'PHYSICAL_EXECUTION_PLAN_ONLY')
  assert.strictEqual(result.spoolPlan.physicalSideEffects, false)
  assert.strictEqual(result.spoolPlan.executionEnabled, false)
  assert.strictEqual(result.spoolPlan.print.copies, 2)
  assert.strictEqual(result.spoolPlan.transport.code, 'WINDOWS_PDF_TRANSPORT_UNRESOLVED')
  assert.strictEqual(result.safety.physicalExecutionPerformed, false)
  assert.strictEqual(result.safety.artifactPersistencePerformed, false)
  assert.strictEqual(result.safety.requiresArtifactPersistence, true)
  assert.strictEqual(result.safety.requiresExplicitPhysicalAuthorization, true)
  assert.strictEqual(result.safety.requiresDedicatedPhysicalExecutor, true)

  const unsupportedEnvelope = Object.freeze({
    ...executionEnvelope,
    documentPurpose: Object.freeze({ code: 'DELIVERY_NOTE', displayName: 'ใบส่งสินค้า' }),
  })

  await assert.rejects(
    () => service.execute({ executionEnvelope: unsupportedEnvelope, readiness }),
    (error) => error.code === 'STORE_DEVICE_PRINT_PURPOSE_RENDERER_UNAVAILABLE',
  )

  await assert.rejects(
    () => service.execute({
      executionEnvelope,
      readiness: Object.freeze({ ...readiness, ready: false, selectedPrinter: null }),
    }),
    (error) => error.code === 'STORE_DEVICE_WINDOWS_PRINT_NOT_READY',
  )

  console.log('store-device-sale-receipt-windows-pdf-spool-plan-runtime.contract.test.js: PASS')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
