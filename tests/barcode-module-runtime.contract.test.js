const fs = require('fs');
const path = require('path');

describe('barcode module runtime ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

  test('root barcode controller stays retired', () => {
    expect(exists('controllers/barcodeController.js')).toBe(false);
  });

  test('active route imports only the module controller', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    expect(route).toContain("require('../barcodeController')");
    expect(route).not.toContain('controllers/barcodeController');
  });

  test('module controller preserves every public barcode handler', () => {
    const controller = read('src/modules/inventory/barcode/barcodeController.js');
    for (const handler of [
      'generateMissingBarcodes',
      'getBarcodesByReceiptId',
      'getBarcodesForPrintBatch',
      'getReceiptsWithBarcodes',
      'searchReprintReceipts',
      'reprintBarcodes',
      'markReceiptAsCompleted',
      'markBarcodesAsPrinted',
      'auditReceiptBarcodes',
      'getReceiptsReadyToScanSN',
      'getReceiptsReadyToScan',
      'updateSerialNumber',
    ]) {
      expect(controller).toContain(handler);
    }
    expect(controller).toContain("require('./runtime/barcodeRuntime')");
  });

  test('runtime preserves identity generation and inventory authority', () => {
    const runtime = read('src/modules/inventory/barcode/runtime/barcodeRuntime.js');
    expect(runtime).toContain('prisma.$transaction');
    expect(runtime).toContain('branchId_yearMonth');
    expect(runtime).toContain("dayjs().format('YYMM')");
    expect(runtime).toContain("mode === 'STRUCTURED'");
    expect(runtime).toContain("mode === 'SIMPLE'");
    expect(runtime).toContain("kind, // 'SN' | 'LOT'");
    expect(runtime).toContain('endNumber > 9999');
    expect(runtime).toContain('barcodeReceiptItem.createMany');
    expect(runtime).toContain('auditReceiptBarcodes');
    expect(runtime).toContain('markReceiptAsCompleted');
    expect(runtime).toContain('updateSerialNumber');
  });

  test('module-local prisma adapter remains explicit', () => {
    const adapter = read('src/modules/inventory/barcode/lib/prisma.js');
    expect(adapter).toContain("require('../../../../../lib/prisma')");
  });
});
