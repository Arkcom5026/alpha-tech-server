'use strict'

const assert = require('assert')
const {
  createStoreDevicePrintRenderRuntimeService,
} = require('../src/modules/storeDevice/print/render/createStoreDevicePrintRenderRuntimeService')

const saleReceiptEnvelope = Object.freeze({
  schemaVersion: 1,
  job: Object.freeze({ jobId: 'sdj_sale_receipt_runtime_101', jobType: 'PRINT_DOCUMENT' }),
  lease: Object.freeze({ leaseId: 'sdl_sale_receipt_runtime_202' }),
  documentPurpose: Object.freeze({ code: 'SALE_RECEIPT', displayName: 'ใบเสร็จรับเงิน' }),
  source: Object.freeze({ type: 'PAYMENT', id: 638 }),
  print: Object.freeze({ copies: 1 }),
  projection: Object.freeze({
    document: Object.freeze({ number: 'RC-000638' }),
  }),
})

async function main() {
  const calls = []
  const artifact = Object.freeze({
    schemaVersion: 1,
    format: 'PDF',
    mediaType: 'application/pdf',
    renderer: 'WINDOWS_BROWSER_PDF',
    physicalSideEffects: false,
  })
  const saleReceiptRenderer = Object.freeze({
    async execute({ executionEnvelope }) {
      calls.push(executionEnvelope)
      return artifact
    },
  })

  const runtime = createStoreDevicePrintRenderRuntimeService({ saleReceiptRenderer })

  assert.deepStrictEqual(runtime.supportedPurposeCodes(), ['SALE_RECEIPT'])

  const resolved = runtime.resolveForEnvelope({ executionEnvelope: saleReceiptEnvelope })
  assert.strictEqual(resolved.purposeCode, 'SALE_RECEIPT')
  assert.strictEqual(resolved.format, 'SALE_RECEIPT_80MM_PDF')
  assert.strictEqual(resolved.renderer, saleReceiptRenderer)

  const rendered = await runtime.render({ executionEnvelope: saleReceiptEnvelope })
  assert.strictEqual(rendered.purposeCode, 'SALE_RECEIPT')
  assert.strictEqual(rendered.format, 'SALE_RECEIPT_80MM_PDF')
  assert.strictEqual(rendered.artifact, artifact)
  assert.strictEqual(calls.length, 1)
  assert.strictEqual(calls[0], saleReceiptEnvelope)

  const unsupportedEnvelope = Object.freeze({
    ...saleReceiptEnvelope,
    documentPurpose: Object.freeze({ code: 'DELIVERY_NOTE', displayName: 'ใบส่งสินค้า' }),
  })

  assert.throws(
    () => runtime.resolveForEnvelope({ executionEnvelope: unsupportedEnvelope }),
    (error) => error.code === 'STORE_DEVICE_PRINT_PURPOSE_RENDERER_UNAVAILABLE',
  )

  await assert.rejects(
    () => runtime.render({ executionEnvelope: unsupportedEnvelope }),
    (error) => error.code === 'STORE_DEVICE_PRINT_PURPOSE_RENDERER_UNAVAILABLE',
  )

  assert.throws(
    () => runtime.resolveForEnvelope({ executionEnvelope: {} }),
    (error) => error.code === 'STORE_DEVICE_PRINT_EXECUTION_ENVELOPE_INVALID',
  )

  console.log('store-device-sale-receipt-runtime-render.contract.test.js: PASS')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
