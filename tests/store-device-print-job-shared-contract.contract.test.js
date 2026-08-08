'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  normalizeCopies,
  createPrintRequestSnapshot,
  assertIdempotentPrintJobCompatibility,
} = require('../src/modules/storeDevice/print/printDocumentJobContract')

assert.strictEqual(normalizeCopies(undefined), 1)
assert.strictEqual(normalizeCopies('3'), 3)
assert.throws(
  () => normalizeCopies(0),
  (error) => error.code === 'STORE_DEVICE_PRINT_COPIES_INVALID',
)

const snapshot = createPrintRequestSnapshot({
  documentPurpose: { code: 'DELIVERY_NOTE', displayName: 'ใบส่งสินค้า' },
  sourceType: 'SALE',
  sourceId: 55,
  copies: 2,
  projection: { document: { type: 'DELIVERY_NOTE' } },
})
assert.strictEqual(snapshot.schemaVersion, 1)
assert.deepStrictEqual(snapshot.source, { type: 'SALE', id: 55 })
assert.deepStrictEqual(snapshot.print, { copies: 2 })

assert.doesNotThrow(() => assertIdempotentPrintJobCompatibility({
  job: { requestSnapshot: snapshot },
  sourceType: 'SALE',
  sourceId: 55,
  copies: 2,
  documentPurpose: { code: 'DELIVERY_NOTE' },
}))

assert.throws(
  () => assertIdempotentPrintJobCompatibility({
    job: { requestSnapshot: snapshot },
    sourceType: 'SALE',
    sourceId: 56,
    copies: 2,
    documentPurpose: { code: 'DELIVERY_NOTE' },
  }),
  (error) =>
    error.code === 'STORE_DEVICE_PRINT_IDEMPOTENCY_CONFLICT'
    && error.statusCode === 409,
)

for (const file of [
  'createDeliveryNotePrintJobService.js',
  'createOutputTaxInvoicePrintJobService.js',
  'createSaleReceiptPrintJobService.js',
]) {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'modules', 'storeDevice', 'print', file),
    'utf8',
  )
  assert.match(source, /require\('\.\/printDocumentJobContract'\)/)
  assert.match(source, /createPrintRequestSnapshot/)
  assert.match(source, /assertIdempotentPrintJobCompatibility/)
  assert.doesNotMatch(source, /targetDeviceId\s*:/)
  assert.doesNotMatch(source, /targetProfileId\s*:/)
}

console.log('store-device-print-job-shared-contract.contract.test.js: PASS')
