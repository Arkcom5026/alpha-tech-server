const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('barcode generation vertical slice ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  test('generation endpoint is owned by the generation slice', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    assert.match(route, /require\('\.\.\/generate\/generateBarcodeController'\)/);
    assert.match(route, /router\.post\('\/generate-missing\/:receiptId', generateMissingBarcodes\)/);
    assert.doesNotMatch(route, /controllers\/barcodeController/);
  });

  test('generation slice owns controller service and repository layers', () => {
    const controller = read('src/modules/inventory/barcode/generate/generateBarcodeController.js');
    const service = read('src/modules/inventory/barcode/generate/generateBarcodeService.js');
    const repository = read('src/modules/inventory/barcode/generate/generateBarcodeRepository.js');

    assert.match(controller, /require\('\.\/generateBarcodeService'\)/);
    assert.match(service, /require\('\.\/generateBarcodeRepository'\)/);
    assert.match(repository, /require\('\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/prisma'\)/);
  });

  test('generation service preserves SN LOT and identity rules', () => {
    const service = read('src/modules/inventory/barcode/generate/generateBarcodeService.js');
    assert.match(service, /mode === 'STRUCTURED'/);
    assert.match(service, /mode === 'SIMPLE'/);
    assert.match(service, /dayjs\(\)\.format\('YYMM'\)/);
    assert.match(service, /padStart\(4, '0'\)/);
    assert.match(service, /counter\.endNumber > 9999/);
  });

  test('repository owns branch receipt query counter reservation rollback and barcode write', () => {
    const repository = read('src/modules/inventory/barcode/generate/generateBarcodeRepository.js');
    assert.match(repository, /prisma\.\$transaction/);
    assert.match(repository, /purchaseOrderReceipt\.findFirst/);
    assert.match(repository, /where: \{ id: receiptId, branchId \}/);
    assert.match(repository, /branchId_yearMonth/);
    assert.match(repository, /increment: totalToCreate/);
    assert.match(repository, /decrement: totalToCreate/);
    assert.match(repository, /barcodeReceiptItem\.createMany/);
  });

  test('all barcode responsibilities coexist under final vertical-slice ownership', () => {
    for (const relativePath of [
      'src/modules/inventory/barcode/query',
      'src/modules/inventory/barcode/print',
      'src/modules/inventory/barcode/scan',
      'src/modules/inventory/barcode/audit',
      'src/modules/inventory/barcode/completion',
    ]) {
      assert.equal(fs.existsSync(path.join(root, relativePath)), true);
    }
  });
});
