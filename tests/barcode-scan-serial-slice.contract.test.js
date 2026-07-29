const fs = require('fs');
const path = require('path');

describe('barcode scan and serial vertical slice ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

  test('scan routes use only the scan controller', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    expect(route).toContain("require('../scan/barcodeScanController')");
    expect(route).toContain("router.get('/ready-to-scan-sn', getReceiptsReadyToScanSN)");
    expect(route).toContain("router.get('/ready-to-scan', getReceiptsReadyToScan)");
    expect(route).toContain("router.patch('/update-serial-number', updateSerialNumber)");
  });

  test('scan slice owns controller service and repository layers', () => {
    const controller = read('src/modules/inventory/barcode/scan/barcodeScanController.js');
    const service = read('src/modules/inventory/barcode/scan/barcodeScanService.js');
    const repository = read('src/modules/inventory/barcode/scan/barcodeScanRepository.js');

    expect(controller).toContain("require('./barcodeScanService')");
    expect(service).toContain("require('./barcodeScanRepository')");
    expect(repository).toContain("require('../../../../../lib/prisma')");
  });

  test('service preserves SN and LOT readiness rules', () => {
    const service = read('src/modules/inventory/barcode/scan/barcodeScanService.js');
    expect(service).toContain("item.kind === 'SN'");
    expect(service).toContain("item.kind === 'LOT'");
    expect(service).toContain("item.status === 'SN_RECEIVED'");
    expect(service).toContain('pendingSN');
    expect(service).toContain('pendingLOT');
    expect(service).toContain('pendingTotal');
  });

  test('serial update preserves sold and duplicate protections', () => {
    const service = read('src/modules/inventory/barcode/scan/barcodeScanService.js');
    const repository = read('src/modules/inventory/barcode/scan/barcodeScanRepository.js');
    expect(service).toContain("toUpperCase() === 'SOLD'");
    expect(service).toContain('stockItem.soldAt != null');
    expect(service).toContain("code: 'SERIAL_DUPLICATE'");
    expect(repository).toContain('NOT: { id: stockItemId }');
    expect(repository).toContain('serialNumber');
  });

  test('audit and completion remain deferred to the root controller', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    expect(route).toContain("require('../../../../../controllers/barcodeController')");
    expect(route).toContain('auditReceiptBarcodes');
    expect(route).toContain('markReceiptAsCompleted');
    expect(exists('src/modules/inventory/barcode/audit')).toBe(false);
    expect(exists('src/modules/inventory/barcode/completion')).toBe(false);
  });
});