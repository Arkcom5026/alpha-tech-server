'use strict'

const assert = require('assert')
const {
  SYSTEM_DOCUMENT_PURPOSES,
  SYSTEM_DOCUMENT_PURPOSE_CODES,
} = require('../src/modules/document-purpose/bootstrap/systemDocumentPurposeCatalog')
const {
  normalizeDocumentPurposeCode,
} = require('../src/modules/document-purpose/shared/documentPurposeDomain')

assert.deepStrictEqual(SYSTEM_DOCUMENT_PURPOSE_CODES, [
  'SALE_RECEIPT',
  'DELIVERY_NOTE',
  'SHORT_TAX_INVOICE',
  'FULL_TAX_INVOICE',
])

assert.strictEqual(SYSTEM_DOCUMENT_PURPOSES.length, 4)
assert.strictEqual(new Set(SYSTEM_DOCUMENT_PURPOSE_CODES).size, SYSTEM_DOCUMENT_PURPOSES.length)

for (const purpose of SYSTEM_DOCUMENT_PURPOSES) {
  assert.strictEqual(normalizeDocumentPurposeCode(purpose.code), purpose.code)
  assert.ok(purpose.displayName)
  assert.ok(purpose.description)
  assert.ok(['SALES', 'TAX'].includes(purpose.categoryCode))
  assert.ok(Number.isInteger(purpose.sortOrder))
  assert.strictEqual(purpose.metadata.printEligible, true)
  assert.strictEqual(purpose.metadata.systemCatalogVersion, 1)
  assert.ok(['SALE', 'OUTPUT_TAX'].includes(purpose.metadata.purposeFamily))
  assert.ok(Object.isFrozen(purpose))
  assert.ok(Object.isFrozen(purpose.metadata))
}

assert.ok(Object.isFrozen(SYSTEM_DOCUMENT_PURPOSES))
assert.ok(Object.isFrozen(SYSTEM_DOCUMENT_PURPOSE_CODES))

console.log('document-purpose-system-catalog.contract.test.js: PASS')
