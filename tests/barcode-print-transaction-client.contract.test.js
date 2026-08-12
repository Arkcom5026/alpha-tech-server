const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryPath = path.join(
  process.cwd(),
  'src/modules/inventory/barcode/print-reprint/barcodePrintReprintRepository.js',
);

const source = fs.readFileSync(repositoryPath, 'utf8');

test('markReceiptPrinted uses callback transaction client delegates', () => {
  assert.match(source, /prisma\.\$transaction\(async\s*\(tx\)\s*=>\s*\{/);
  assert.match(source, /tx\.barcodeReceiptItem\.updateMany/);
  assert.match(source, /tx\.purchaseOrderReceipt\.updateMany/);
  assert.doesNotMatch(source, /prisma\.barcodeReceiptItem\.updateMany/);
  assert.doesNotMatch(source, /prisma\.purchaseOrderReceipt\.updateMany/);
});
