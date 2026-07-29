const fs = require('fs');
const path = require('path');

describe('receipt completion vertical slice ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  test('completion aliases use only the completion controller', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    expect(route).toContain("require('../completion/receiptCompletionController')");
    expect(route).toContain("router.patch('/receipts/:receiptId/complete', markReceiptAsCompleted)");
    expect(route).toContain("router.patch('/receipts/:id/complete', markReceiptAsCompleted)");
    expect(route).not.toContain("require('../../../../../controllers/barcodeController')");
  });

  test('completion owns controller service and repository layers', () => {
    const controller = read('src/modules/inventory/barcode/completion/receiptCompletionController.js');
    const service = read('src/modules/inventory/barcode/completion/receiptCompletionService.js');
    const repository = read('src/modules/inventory/barcode/completion/receiptCompletionRepository.js');

    expect(controller).toContain("require('./receiptCompletionService')");
    expect(service).toContain("require('./receiptCompletionRepository')");
    expect(repository).toContain("require('../../../../../lib/prisma')");
  });

  test('preserves branch scope, completion status and conflict contract', () => {
    const controller = read('src/modules/inventory/barcode/completion/receiptCompletionController.js');
    const service = read('src/modules/inventory/barcode/completion/receiptCompletionService.js');
    const repository = read('src/modules/inventory/barcode/completion/receiptCompletionRepository.js');

    expect(repository).toContain('where: { id: receiptId, branchId }');
    expect(repository).toContain("statusReceipt: 'COMPLETED'");
    expect(service).toContain("code: 'RECEIPT_NOT_FOUND'");
    expect(service).toContain("code: 'UPDATE_CONFLICT'");
    expect(controller).toContain('res.status(404)');
    expect(controller).toContain('res.status(409)');
  });
});
