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

test('markReceiptPrinted performs both updates through the callback transaction client', () => {
  assert.match(source, /prisma\.\$transaction\(async\s*\(tx\)\s*=>\s*\{/);
  assert.match(source, /tx\.barcodeReceiptItem\.updateMany/);
  assert.match(source, /tx\.purchaseOrderReceipt\.updateMany/);
});
