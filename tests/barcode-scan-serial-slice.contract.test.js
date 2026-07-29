const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('barcode scan and serial vertical slice ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

  test('scan routes use only the scan controller', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    assert.match(route, /require\('\.\.\/scan\/barcodeScanController'\)/);
    assert.match(route, /router\.get\('\/ready-to-scan-sn', getReceiptsReadyToScanSN\)/);
    assert.match(route, /router\.get\('\/ready-to-scan', getReceiptsReadyToScan\)/);
    assert.match(route, /router\.patch\('\/update-serial-number', updateSerialNumber\)/);
    assert.doesNotMatch(route, /controllers\/barcodeController/);
  });

  test('scan slice owns controller service and repository layers', () => {
    const controller = read('src/modules/inventory/barcode/scan/barcodeScanController.js');
    const service = read('src/modules/inventory/barcode/scan/barcodeScanService.js');
    const repository = read('src/modules/inventory/barcode/scan/barcodeScanRepository.js');

    assert.match(controller, /require\('\.\/barcodeScanService'\)/);
    assert.match(service, /require\('\.\/barcodeScanRepository'\)/);
    assert.match(repository, /require\('\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/prisma'\)/);
  });

  test('service preserves SN and LOT readiness rules', () => {
    const service = read('src/modules/inventory/barcode/scan/barcodeScanService.js');
    assert.match(service, /item\.kind === 'SN'/);
    assert.match(service, /item\.kind === 'LOT'/);
    assert.match(service, /item\.status === 'SN_RECEIVED'/);
    assert.match(service, /pendingSN/);
    assert.match(service, /pendingLOT/);
    assert.match(service, /pendingTotal/);
  });

  test('serial update preserves sold and duplicate protections', () => {
    const service = read('src/modules/inventory/barcode/scan/barcodeScanService.js');
    const repository = read('src/modules/inventory/barcode/scan/barcodeScanRepository.js');
    assert.match(service, /toUpperCase\(\) === 'SOLD'/);
    assert.match(service, /stockItem\.soldAt != null/);
    assert.match(service, /code: 'SERIAL_DUPLICATE'/);
    assert.match(repository, /NOT: \{ id: stockItemId \}/);
    assert.match(repository, /serialNumber/);
  });

  test('audit and completion are present under final vertical-slice ownership', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    assert.match(route, /require\('\.\.\/audit\/barcodeAuditController'\)/);
    assert.match(route, /require\('\.\.\/completion\/receiptCompletionController'\)/);
    assert.match(route, /auditReceiptBarcodes/);
    assert.match(route, /markReceiptAsCompleted/);
    assert.equal(exists('src/modules/inventory/barcode/audit'), true);
    assert.equal(exists('src/modules/inventory/barcode/completion'), true);
  });
});
