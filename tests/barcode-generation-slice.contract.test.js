const fs = require('fs');
const path = require('path');

describe('barcode generation vertical slice ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  test('only generation endpoint leaves the root controller in this increment', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    expect(route).toContain("require('../generate/generateBarcodeController')");
    expect(route).toContain("require('../../../../../controllers/barcodeController')");
    expect(route).toContain("router.post('/generate-missing/:receiptId', generateMissingBarcodes)");
  });

  test('generation slice owns controller service and repository layers', () => {
    const controller = read('src/modules/inventory/barcode/generate/generateBarcodeController.js');
    const service = read('src/modules/inventory/barcode/generate/generateBarcodeService.js');
    const repository = read('src/modules/inventory/barcode/generate/generateBarcodeRepository.js');

    expect(controller).toContain("require('./generateBarcodeService')");
    expect(service).toContain("require('./generateBarcodeRepository')");
    expect(repository).toContain("require('../../../../../lib/prisma')");
  });

  test('generation service preserves SN LOT and identity rules', () => {
    const service = read('src/modules/inventory/barcode/generate/generateBarcodeService.js');
    expect(service).toContain("mode === 'STRUCTURED'");
    expect(service).toContain("mode === 'SIMPLE'");
    expect(service).toContain("dayjs().format('YYMM')");
    expect(service).toContain("padStart(4, '0')");
    expect(service).toContain('counter.endNumber > 9999');
  });

  test('repository owns branch receipt query counter reservation rollback and barcode write', () => {
    const repository = read('src/modules/inventory/barcode/generate/generateBarcodeRepository.js');
    expect(repository).toContain('prisma.$transaction');
    expect(repository).toContain('purchaseOrderReceipt.findFirst');
    expect(repository).toContain('where: { id: receiptId, branchId }');
    expect(repository).toContain('branchId_yearMonth');
    expect(repository).toContain('increment: totalToCreate');
    expect(repository).toContain('decrement: totalToCreate');
    expect(repository).toContain('barcodeReceiptItem.createMany');
  });

  test('unrelated barcode responsibilities are not introduced as slices here', () => {
    for (const relativePath of [
      'src/modules/inventory/barcode/query',
      'src/modules/inventory/barcode/print',
      'src/modules/inventory/barcode/scan',
      'src/modules/inventory/barcode/audit',
      'src/modules/inventory/barcode/complete',
    ]) {
      expect(fs.existsSync(path.join(root, relativePath))).toBe(false);
    }
  });
});
