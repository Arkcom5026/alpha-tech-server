'use strict'

const assert = require('assert')
const {
  PRINT_RENDER_FORMATS,
  createPrintRenderArtifact,
  assertPrintRenderArtifact,
} = require('../src/modules/storeDevice/print/render/printRenderArtifactContract')

assert.deepStrictEqual(
  PRINT_RENDER_FORMATS,
  ['PDF', 'HTML', 'XPS', 'EMF', 'DRY_RUN_MANIFEST'],
)

const artifact = createPrintRenderArtifact({
  format: 'PDF',
  mediaType: 'application/pdf',
  renderer: 'TEST_RENDERER',
  documentPurpose: {
    code: 'DELIVERY_NOTE',
    displayName: 'ใบส่งสินค้า',
  },
  source: { type: 'SALE', id: 123 },
  pageCount: 2,
  byteLength: 1024,
  checksum: 'sha256:test',
  payload: { reference: 'test' },
})

assert.strictEqual(artifact.schemaVersion, 1)
assert.strictEqual(artifact.format, 'PDF')
assert.strictEqual(artifact.physicalSideEffects, false)
assert.strictEqual(artifact.documentPurpose.code, 'DELIVERY_NOTE')
assert.strictEqual(artifact.source.type, 'SALE')
assert.strictEqual(artifact.source.id, 123)
assert.strictEqual(artifact.pageCount, 2)
assert.strictEqual(assertPrintRenderArtifact(artifact), artifact)

assert.throws(
  () => createPrintRenderArtifact({
    format: 'RAW',
    mediaType: 'application/octet-stream',
    renderer: 'TEST',
    documentPurpose: { code: 'SALE_RECEIPT' },
    source: { type: 'PAYMENT', id: 1 },
  }),
  (error) => error.code === 'STORE_DEVICE_PRINT_RENDER_FORMAT_INVALID',
)

assert.throws(
  () => assertPrintRenderArtifact({ schemaVersion: 1, format: 'PDF' }),
  (error) => error.code === 'STORE_DEVICE_PRINT_RENDER_ARTIFACT_INVALID',
)

console.log('store-device-print-render-artifact.contract.test.js: PASS')
