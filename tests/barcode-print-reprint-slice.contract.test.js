const fs = require('fs');
const path = require('path');

describe('barcode print and reprint vertical slice ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  test('print endpoints leave the root controller together', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    expect(route).toContain("require('../print/barcodePrintController')");
    expect(route).toContain("router.get('/print-batch', getBarcodesForPrintBatch)");
    expect(route).toContain("router.get('/with-barcodes', getReceiptsWithBarcodes)");
    expect(route).toContain("router.get('/receipts-with-barcodes', getReceiptsWithBarcodes)");
    expect(route).toContain("router.get('/reprint-search', searchReprintReceipts)");
    expect(route).toContain("router.patch('/mark-printed', markBarcodesAsPrinted)");
    expect(route).toContain("router.patch('/reprint/:receiptId', reprintBarcodes)");
  });

  test('print slice owns controller service and repository', () => {
    const controller = read('src/modules/inventory/barcode/print/barcodePrintController.js');
    const service = read('src/modules/inventory/barcode/print/barcodePrintService.js');
    const repository = read('src/modules/inventory/barcode/print/barcodePrintRepository.js');
    expect(controller).toContain("require('./barcodePrintService')");
    expect(service).toContain("require('./barcodePrintRepository')");
    expect(repository).toContain("require('../../../../../lib/prisma')");
  });

  test('print slice reuses generation authority', () => {
    const service = read('src/modules/inventory/barcode/print/barcodePrintService.js');
    expect(service).toContain("require('../generate/generateBarcodeService')");
    expect(service).toContain('generateMissingBarcodes');
    expect(service).not.toContain('barcodeCounter');
    expect(service).not.toContain('createMany');
  });

  test('printed state remains atomic and branch scoped', () => {
    const repository = read('src/modules/inventory/barcode/print/barcodePrintRepository.js');
    expect(repository).toContain('prisma.$transaction');
    expect(repository).toContain('printed: false');
    expect(repository).toContain('data: { printed: true }');
    expect(repository).toContain('where: { id: receiptId, branchId }');
  });

  test('search and projection contracts remain present', () => {
    const service = read('src/modules/inventory/barcode/print/barcodePrintService.js');
    expect(service).toContain("mode === 'RC'");
    expect(service).toContain("mode === 'PO'");
    expect(service).toContain("mode === 'SUP'");
    expect(service).toContain("mode === 'ALL'");
    expect(service).toContain('qtyLabelsSuggested');
    expect(service).toContain('creditRemaining');
    expect(service).toContain('stockItemSaleItemId');
    expect(service).toContain('extractReceiptId');
  });

  test('scan audit and completion remain deferred', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    expect(route).toContain("require('../../../../../controllers/barcodeController')");
    expect(route).toContain('getReceiptsReadyToScanSN');
    expect(route).toContain('getReceiptsReadyToScan');
    expect(route).toContain('updateSerialNumber');
    expect(route).toContain('auditReceiptBarcodes');
    expect(route).toContain('markReceiptAsCompleted');
  });
});
