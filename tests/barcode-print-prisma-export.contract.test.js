const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryPath = path.join(
  process.cwd(),
  'src/modules/inventory/barcode/print-reprint/barcodePrintReprintRepository.js',
);

const source = fs.readFileSync(repositoryPath, 'utf8');

test('barcode print repository uses the canonical destructured Prisma singleton export', () => {
  assert.match(source, /const\s*\{\s*prisma\s*\}\s*=\s*require\(['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/prisma['"]\)/);
  assert.doesNotMatch(source, /const\s+prisma\s*=\s*require\(['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/prisma['"]\)/);
});

test('markReceiptPrinted updates barcode rows and receipt through Prisma delegates', () => {
  assert.match(source, /prisma\.barcodeReceiptItem\.updateMany/);
  assert.match(source, /prisma\.purchaseOrderReceipt\.updateMany/);
  assert.match(source, /prisma\.\$transaction/);
});
