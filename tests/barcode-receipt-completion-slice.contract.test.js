const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('receipt completion vertical slice ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  test('completion aliases use only the completion controller', () => {
    const route = read('src/modules/inventory/barcode/routes/barcodeRoutes.js');
    assert.match(route, /require\('\.\.\/completion\/receiptCompletionController'\)/);
    assert.match(route, /router\.patch\('\/receipts\/:receiptId\/complete', markReceiptAsCompleted\)/);
    assert.match(route, /router\.patch\('\/receipts\/:id\/complete', markReceiptAsCompleted\)/);
    assert.doesNotMatch(route, /controllers\/barcodeController/);
  });

  test('completion owns controller service and repository layers', () => {
    const controller = read('src/modules/inventory/barcode/completion/receiptCompletionController.js');
    const service = read('src/modules/inventory/barcode/completion/receiptCompletionService.js');
    const repository = read('src/modules/inventory/barcode/completion/receiptCompletionRepository.js');

    assert.match(controller, /require\('\.\/receiptCompletionService'\)/);
    assert.match(service, /require\('\.\/receiptCompletionRepository'\)/);
    assert.match(repository, /require\('\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/prisma'\)/);
  });

  test('preserves branch scope, completion status and conflict contract', () => {
    const controller = read('src/modules/inventory/barcode/completion/receiptCompletionController.js');
    const service = read('src/modules/inventory/barcode/completion/receiptCompletionService.js');
    const repository = read('src/modules/inventory/barcode/completion/receiptCompletionRepository.js');

    assert.match(repository, /where: \{ id: receiptId, branchId \}/);
    assert.match(repository, /statusReceipt: 'COMPLETED'/);
    assert.match(service, /code: 'RECEIPT_NOT_FOUND'/);
    assert.match(service, /code: 'UPDATE_CONFLICT'/);
    assert.match(controller, /res\.status\(404\)/);
    assert.match(controller, /res\.status\(409\)/);
  });
});
