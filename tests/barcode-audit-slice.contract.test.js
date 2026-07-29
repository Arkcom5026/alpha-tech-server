const fs = require('fs');
const path = require('path');

describe('barcode audit vertical slice ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  test('audit route uses only the audit controller', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    expect(route).toContain("require('../audit/barcodeAuditController')");
    expect(route).toContain("router.get('/receipt/:receiptId/audit', auditReceiptBarcodes)");
    expect(route).toContain('markReceiptAsCompleted');
  });

  test('audit owns controller service and repository layers', () => {
    const controller = read('src/modules/inventory/barcode/audit/barcodeAuditController.js');
    const service = read('src/modules/inventory/barcode/audit/barcodeAuditService.js');
    const repository = read('src/modules/inventory/barcode/audit/barcodeAuditRepository.js');
    expect(controller).toContain("require('./barcodeAuditService')");
    expect(service).toContain("require('./barcodeAuditRepository')");
    expect(repository).toContain("require('../../../../../lib/prisma')");
  });

  test('audit preserves classifications and anomaly contracts', () => {
    const service = read('src/modules/inventory/barcode/audit/barcodeAuditService.js');
    for (const token of [
      'STRUCTURED_MISSING_SN_BARCODES',
      'STRUCTURED_HAS_LOT_BARCODES',
      'SIMPLE_MISSING_LOT_BARCODES',
      'SIMPLE_HAS_MULTIPLE_BARCODES',
      'SIMPLE_HAS_SN_BARCODES',
      'mixedItems',
      'unknownItems',
      'includeDetails',
    ]) expect(service).toContain(token);
  });

  test('repository remains branch-scoped and read-only', () => {
    const repository = read('src/modules/inventory/barcode/audit/barcodeAuditRepository.js');
    expect(repository).toContain('where: { id: receiptId, branchId }');
    expect(repository).toContain('purchaseOrderReceiptItem.findMany');
    expect(repository).toContain('barcodeReceiptItem.findMany');
    expect(repository).toContain('stockItem.findMany');
    expect(repository).toContain('simpleLot.findMany');
    expect(repository).not.toContain('.create(');
    expect(repository).not.toContain('.update(');
    expect(repository).not.toContain('.delete(');
  });
});
