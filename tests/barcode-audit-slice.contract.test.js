const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('barcode audit vertical slice ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  test('audit route uses only the audit controller', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    assert.match(route, /require\('\.\.\/audit\/barcodeAuditController'\)/);
    assert.match(route, /router\.get\('\/receipt\/:receiptId\/audit', auditReceiptBarcodes\)/);
    assert.match(route, /markReceiptAsCompleted/);
    assert.doesNotMatch(route, /controllers\/barcodeController/);
  });

  test('audit owns controller service and repository layers', () => {
    const controller = read('src/modules/inventory/barcode/audit/barcodeAuditController.js');
    const service = read('src/modules/inventory/barcode/audit/barcodeAuditService.js');
    const repository = read('src/modules/inventory/barcode/audit/barcodeAuditRepository.js');
    assert.match(controller, /require\('\.\/barcodeAuditService'\)/);
    assert.match(service, /require\('\.\/barcodeAuditRepository'\)/);
    assert.match(repository, /require\('\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/prisma'\)/);
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
    ]) assert.match(service, new RegExp(token));
  });

  test('repository remains branch-scoped and read-only', () => {
    const repository = read('src/modules/inventory/barcode/audit/barcodeAuditRepository.js');
    assert.match(repository, /where: \{ id: receiptId, branchId \}/);
    assert.match(repository, /purchaseOrderReceiptItem\.findMany/);
    assert.match(repository, /barcodeReceiptItem\.findMany/);
    assert.match(repository, /stockItem\.findMany/);
    assert.match(repository, /simpleLot\.findMany/);
    assert.doesNotMatch(repository, /\.create\(/);
    assert.doesNotMatch(repository, /\.update\(/);
    assert.doesNotMatch(repository, /\.delete\(/);
  });
});
