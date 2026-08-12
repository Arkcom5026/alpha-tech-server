const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryPath = path.join(
  process.cwd(),
  'src/modules/inventory/barcode/print-reprint/barcodePrintReprintRepository.js',
);

const source = fs.readFileSync(repositoryPath, 'utf8');

test('markReceiptPrinted avoids the stock-movement transaction delegate proxy', () => {
  assert.doesNotMatch(source, /tx\.barcodeReceiptItem\.updateMany/);
  assert.doesNotMatch(source, /tx\.purchaseOrderReceipt\.updateMany/);
  assert.match(source, /prisma\.barcodeReceiptItem\.updateMany/);
  assert.match(source, /prisma\.purchaseOrderReceipt\.updateMany/);
});

test('markReceiptPrinted remains idempotent and service-compatible', () => {
  assert.match(source, /printed:\s*false/);
  assert.match(source, /data:\s*\{\s*printed:\s*true\s*\}/);
  assert.match(source, /return\s*\[\s*barcodeResult\s*,\s*receiptResult\s*\]/);
});
