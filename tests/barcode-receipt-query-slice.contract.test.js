const fs = require('fs');
const path = require('path');

describe('receipt barcode query vertical slice ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  test('only by-receipt endpoint leaves the root controller in this increment', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    expect(route).toContain("require('../query/receiptBarcodeQueryController')");
    expect(route).toContain("require('../../../../../controllers/barcodeController')");
    expect(route).toContain("router.get('/by-receipt/:receiptId', getBarcodesByReceiptId)");
    expect(route).toContain("router.get('/print-batch', getBarcodesForPrintBatch)");
  });

  test('query slice owns controller service and repository layers', () => {
    const controller = read('src/modules/inventory/barcode/query/receiptBarcodeQueryController.js');
    const service = read('src/modules/inventory/barcode/query/receiptBarcodeQueryService.js');
    const repository = read('src/modules/inventory/barcode/query/receiptBarcodeQueryRepository.js');

    expect(controller).toContain("require('./receiptBarcodeQueryService')");
    expect(service).toContain("require('./receiptBarcodeQueryRepository')");
    expect(repository).toContain("require('../../../../../lib/prisma')");
  });

  test('query service reuses generation service instead of duplicating generation persistence', () => {
    const service = read('src/modules/inventory/barcode/query/receiptBarcodeQueryService.js');
    expect(service).toContain("require('../generate/generateBarcodeService')");
    expect(service).toContain('generateMissingBarcodes');
    expect(service).not.toContain('barcodeCounter');
    expect(service).not.toContain('barcodeReceiptItem.createMany');
  });

  test('query behavior preserves filters fallback and projection semantics', () => {
    const controller = read('src/modules/inventory/barcode/query/receiptBarcodeQueryController.js');
    const service = read('src/modules/inventory/barcode/query/receiptBarcodeQueryService.js');
    const repository = read('src/modules/inventory/barcode/query/receiptBarcodeQueryRepository.js');

    expect(controller).toContain('onlyUnscanned');
    expect(controller).toContain('onlyUnactivated');
    expect(controller).toContain('includeFallback');
    expect(controller).toContain("Cache-Control");
    expect(repository).toContain('stockItemId: null');
    expect(repository).toContain("status: { not: 'SN_RECEIVED' }");
    expect(repository).toContain('purchaseOrderReceiptItemId');
    expect(service).toContain('productName');
    expect(service).toContain('stockItemStatus');
    expect(service).toContain('qtyLabelsSuggested');
  });

  test('unrelated barcode slices remain deferred', () => {
    for (const directory of ['print', 'scan', 'audit', 'complete']) {
      expect(fs.existsSync(path.join(root, `src/modules/inventory/barcode/${directory}`))).toBe(false);
    }
  });
});
