const fs = require('fs');
const path = require('path');

describe('sales report module runtime ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

  test('root sales report controller stays retired', () => {
    expect(exists('controllers/salesReportController.js')).toBe(false);
  });

  test('active route imports only the module controller', () => {
    const route = read('src/modules/reporting/sales/routes/salesReportRoutes.js');
    expect(route).toContain("require('../salesReportController')");
    expect(route).not.toContain('controllers/salesReportController');
  });

  test('module controller preserves all public report contracts', () => {
    const controller = read('src/modules/reporting/sales/salesReportController.js');
    for (const handler of [
      'getSalesTaxReport',
      'getSalesDashboard',
      'getSalesList',
      'getProductPerformance',
      'getSalesDetail',
    ]) {
      expect(controller).toContain(handler);
    }
    expect(controller).toContain("require('./runtime/salesReportRuntime')");
  });

  test('runtime preserves branch scope, filtering, dashboard and tax calculations', () => {
    const runtime = read('src/modules/reporting/sales/runtime/salesReportRuntime.js');
    expect(runtime).toContain('req.user?.branchId');
    expect(runtime).toContain('buildSalesWhere');
    expect(runtime).toContain('getSalesDashboard');
    expect(runtime).toContain('getSalesList');
    expect(runtime).toContain('getProductPerformance');
    expect(runtime).toContain('getSalesDetail');
    expect(runtime).toContain('getSalesTaxReport');
    expect(runtime).toContain('Prisma.Decimal');
    expect(runtime).toContain('paymentMethod');
  });

  test('module-local prisma adapter remains explicit', () => {
    const adapter = read('src/modules/reporting/sales/lib/prisma.js');
    expect(adapter).toContain("require('../../../../../lib/prisma')");
  });
});
