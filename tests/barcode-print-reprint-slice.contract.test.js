const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('barcode print and reprint vertical slice ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  test('print endpoints are owned by the print controller', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    assert.match(route, /require\('\.\.\/print\/barcodePrintController'\)/);
    assert.match(route, /router\.get\('\/print-batch', getBarcodesForPrintBatch\)/);
    assert.match(route, /router\.get\('\/with-barcodes', getReceiptsWithBarcodes\)/);
    assert.match(route, /router\.get\('\/receipts-with-barcodes', getReceiptsWithBarcodes\)/);
    assert.match(route, /router\.get\('\/reprint-search', searchReprintReceipts\)/);
    assert.match(route, /router\.patch\('\/mark-printed', markBarcodesAsPrinted\)/);
    assert.match(route, /router\.patch\('\/reprint\/:receiptId', reprintBarcodes\)/);
    assert.doesNotMatch(route, /controllers\/barcodeController/);
  });

  test('print slice owns controller service and repository', () => {
    const controller = read('src/modules/inventory/barcode/print/barcodePrintController.js');
    const service = read('src/modules/inventory/barcode/print/barcodePrintService.js');
    const repository = read('src/modules/inventory/barcode/print/barcodePrintRepository.js');
    assert.match(controller, /require\('\.\/barcodePrintService'\)/);
    assert.match(service, /require\('\.\/barcodePrintRepository'\)/);
    assert.match(repository, /require\('\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/prisma'\)/);
  });

  test('print slice reuses generation authority', () => {
    const service = read('src/modules/inventory/barcode/print/barcodePrintService.js');
    assert.match(service, /require\('\.\.\/generate\/generateBarcodeService'\)/);
    assert.match(service, /generateMissingBarcodes/);
    assert.doesNotMatch(service, /barcodeCounter/);
    assert.doesNotMatch(service, /createMany/);
  });

  test('printed state remains atomic and branch scoped', () => {
    const repository = read('src/modules/inventory/barcode/print/barcodePrintRepository.js');
    assert.match(repository, /prisma\.\$transaction/);
    assert.match(repository, /printed: false/);
    assert.match(repository, /data: \{ printed: true \}/);
    assert.match(repository, /where: \{ id: receiptId, branchId \}/);
  });

  test('search and projection contracts remain present', () => {
    const service = read('src/modules/inventory/barcode/print/barcodePrintService.js');
    for (const token of [
      "mode === 'RC'",
      "mode === 'PO'",
      "mode === 'SUP'",
      "mode === 'ALL'",
      'qtyLabelsSuggested',
      'creditRemaining',
      'stockItemSaleItemId',
      'extractReceiptId',
    ]) assert.match(service, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  test('scan audit and completion are owned by their vertical slices', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    assert.match(route, /require\('\.\.\/scan\/barcodeScanController'\)/);
    assert.match(route, /require\('\.\.\/audit\/barcodeAuditController'\)/);
    assert.match(route, /require\('\.\.\/completion\/receiptCompletionController'\)/);
    assert.match(route, /getReceiptsReadyToScanSN/);
    assert.match(route, /getReceiptsReadyToScan/);
    assert.match(route, /updateSerialNumber/);
    assert.match(route, /auditReceiptBarcodes/);
    assert.match(route, /markReceiptAsCompleted/);
  });
});
