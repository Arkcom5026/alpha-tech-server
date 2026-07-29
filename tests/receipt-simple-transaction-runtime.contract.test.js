const fs = require('fs');
const path = require('path');

describe('receipt simple transaction runtime ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

  test('root receipt simple controller stays retired', () => {
    expect(exists('controllers/receiptSimpleController.js')).toBe(false);
  });

  test('module controller delegates only to module-owned runtime', () => {
    const controller = read('src/modules/procurement/receipt/simple/receiptSimpleController.js');

    expect(controller).toContain("require('./runtime/receiptSimpleRuntime')");
    expect(controller).not.toContain('controllers/receiptSimpleController');
  });

  test('module runtime preserves the multi-ledger transaction sequence', () => {
    const runtime = read('src/modules/procurement/receipt/simple/runtime/receiptSimpleRuntime.js');

    const requiredOperations = [
      'tx.purchaseOrder.create',
      'tx.purchaseOrderItem.create',
      'tx.purchaseOrderReceipt.create',
      'tx.purchaseOrderReceiptItem.create',
      'tx.branchInventory.upsert',
      'tx.stockMovement.create',
      'recordInventoryTransactions',
      'recordPaymentIfAny',
    ];

    for (const operation of requiredOperations) {
      expect(runtime).toContain(operation);
    }

    expect(runtime).toContain('prisma.$transaction');
    expect(runtime).toContain('module.exports = { create, preview }');
  });

  test('module-local prisma adapter remains explicit', () => {
    const adapter = read('src/modules/procurement/receipt/simple/lib/prisma.js');
    expect(adapter).toContain("require('../../../../../lib/prisma')");
  });
});
