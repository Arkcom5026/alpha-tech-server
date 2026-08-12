const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getRequiredBarcodeCount,
  getMissingBarcodeCount,
} = require('./generateReceiptBarcodesRepository');

test('STRUCTURED requires one barcode identity per received unit', () => {
  assert.equal(getRequiredBarcodeCount({ mode: 'STRUCTURED', quantity: 5 }), 5);
  assert.equal(getRequiredBarcodeCount({ mode: 'STRUCTURED', quantity: '3' }), 3);
});

test('SIMPLE requires one LOT barcode identity regardless of quantity', () => {
  assert.equal(getRequiredBarcodeCount({ mode: 'SIMPLE', quantity: 25 }), 1);
  assert.equal(getRequiredBarcodeCount({ mode: 'simple', quantity: 1 }), 1);
});

test('generation creates only missing STRUCTURED identities', () => {
  assert.equal(getMissingBarcodeCount({ mode: 'STRUCTURED', quantity: 5, existingCount: 0 }), 5);
  assert.equal(getMissingBarcodeCount({ mode: 'STRUCTURED', quantity: 5, existingCount: 2 }), 3);
  assert.equal(getMissingBarcodeCount({ mode: 'STRUCTURED', quantity: 5, existingCount: 5 }), 0);
});

test('repeated generation is idempotent once required identities already exist', () => {
  assert.equal(getMissingBarcodeCount({ mode: 'STRUCTURED', quantity: 5, existingCount: 7 }), 0);
  assert.equal(getMissingBarcodeCount({ mode: 'SIMPLE', quantity: 20, existingCount: 1 }), 0);
});

test('VOID identities do not satisfy the active identity requirement', () => {
  // Repository count excludes VOID rows, so a replacement identity is required.
  assert.equal(getMissingBarcodeCount({ mode: 'STRUCTURED', quantity: 2, existingCount: 1 }), 1);
  assert.equal(getMissingBarcodeCount({ mode: 'SIMPLE', quantity: 10, existingCount: 0 }), 1);
});
