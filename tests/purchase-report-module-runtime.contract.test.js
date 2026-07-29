const fs = require('fs');
const path = require('path');

describe('purchase report module runtime ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

  test('root purchase report controller stays retired', () => {
    expect(exists('controllers/purchaseReportController.js')).toBe(false);
  });

  test('active route imports only the module controller', () => {
    const route = read('src/modules/reporting/purchase/routes/purchaseReportRoutes.js');
    expect(route).toContain("require('../purchaseReportController')");
    expect(route).not.toContain('controllers/purchaseReportController');
  });

  test('module controller preserves all public report contracts', () => {
    const controller = read('src/modules/reporting/purchase/purchaseReportController.js');
    expect(controller).toContain('getPurchaseReport');
    expect(controller).toContain('getPurchaseReceiptReport');
    expect(controller).toContain('getPurchaseReceiptReportDetail');
    expect(controller).toContain("require('./runtime/purchaseReportRuntime')");
  });

  test('runtime preserves branch scope, PO and quick receipt paths, and decimal totals', () => {
    const runtime = read('src/modules/reporting/purchase/runtime/purchaseReportRuntime.js');
    expect(runtime).toContain('req.user?.branchId');
    expect(runtime).toContain('purchaseOrderReceiptItem.findMany');
    expect(runtime).toContain('purchaseOrderReceipt.findMany');
    expect(runtime).toContain('purchaseOrder');
    expect(runtime).toContain('supplier');
    expect(runtime).toContain('new Prisma.Decimal(0)');
    expect(runtime).toContain('getPurchaseReceiptReportDetail');
  });

  test('module-local prisma adapter remains explicit', () => {
    const adapter = read('src/modules/reporting/purchase/lib/prisma.js');
    expect(adapter).toContain("require('../../../../../lib/prisma')");
  });
});
