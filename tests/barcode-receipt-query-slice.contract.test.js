const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('receipt barcode query vertical slice ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  test('by-receipt endpoint is owned by the query slice', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    assert.match(route, /require\('\.\.\/query\/receiptBarcodeQueryController'\)/);
    assert.match(route, /router\.get\('\/by-receipt\/:receiptId', getBarcodesByReceiptId\)/);
    assert.match(route, /router\.get\('\/print-batch', getBarcodesForPrintBatch\)/);
    assert.doesNotMatch(route, /controllers\/barcodeController/);
  });

  test('query slice owns controller service and repository layers', () => {
    const controller = read('src/modules/inventory/barcode/query/receiptBarcodeQueryController.js');
    const service = read('src/modules/inventory/barcode/query/receiptBarcodeQueryService.js');
    const repository = read('src/modules/inventory/barcode/query/receiptBarcodeQueryRepository.js');

    assert.match(controller, /require\('\.\/receiptBarcodeQueryService'\)/);
    assert.match(service, /require\('\.\/receiptBarcodeQueryRepository'\)/);
    assert.match(repository, /require\('\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/prisma'\)/);
  });

  test('query service reuses generation service instead of duplicating generation persistence', () => {
    const service = read('src/modules/inventory/barcode/query/receiptBarcodeQueryService.js');
    assert.match(service, /require\('\.\.\/generate\/generateBarcodeService'\)/);
    assert.match(service, /generateMissingBarcodes/);
    assert.doesNotMatch(service, /barcodeCounter/);
    assert.doesNotMatch(service, /barcodeReceiptItem\.createMany/);
  });

  test('query behavior preserves filters fallback and projection semantics', () => {
    const controller = read('src/modules/inventory/barcode/query/receiptBarcodeQueryController.js');
    const service = read('src/modules/inventory/barcode/query/receiptBarcodeQueryService.js');
    const repository = read('src/modules/inventory/barcode/query/receiptBarcodeQueryRepository.js');

    assert.match(controller, /onlyUnscanned/);
    assert.match(controller, /onlyUnactivated/);
    assert.match(controller, /includeFallback/);
    assert.match(controller, /Cache-Control/);
    assert.match(repository, /stockItemId: null/);
    assert.match(repository, /status: \{ not: 'SN_RECEIVED' \}/);
    assert.match(repository, /purchaseOrderReceiptItemId/);
    assert.match(service, /productName/);
    assert.match(service, /stockItemStatus/);
    assert.match(service, /qtyLabelsSuggested/);
  });

  test('all later barcode slices coexist under final ownership', () => {
    for (const directory of ['print', 'scan', 'audit', 'completion']) {
      assert.equal(fs.existsSync(path.join(root, `src/modules/inventory/barcode/${directory}`)), true);
    }
  });
});
