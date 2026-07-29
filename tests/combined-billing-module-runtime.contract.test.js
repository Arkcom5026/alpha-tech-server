const fs = require('fs');
const path = require('path');

describe('combined billing module runtime ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

  test('root combined billing controller stays retired', () => {
    expect(exists('controllers/combinedBillingController.js')).toBe(false);
  });

  test('active route imports only the module controller', () => {
    const route = read('src/modules/finance/combined-billing/routes/combinedBillingRoutes.js');
    expect(route).toContain("require('../combinedBillingController')");
    expect(route).not.toContain('controllers/combinedBillingController');
  });

  test('module controller preserves all public handlers', () => {
    const controller = read('src/modules/finance/combined-billing/combinedBillingController.js');
    for (const handler of [
      'getCombinableSales',
      'createCombinedBillingDocument',
      'getCombinedBillingById',
      'getCustomersWithPendingSales',
    ]) {
      expect(controller).toContain(handler);
    }
    expect(controller).toContain("require('./runtime/combinedBillingRuntime')");
  });

  test('runtime preserves document authority and atomic sale finalization', () => {
    const runtime = read('src/modules/finance/combined-billing/runtime/combinedBillingRuntime.js');
    expect(runtime).toContain('CBL-${paddedBranch}${yearMonth}');
    expect(runtime).toContain('now.year() + 543');
    expect(runtime).toContain('prisma.$transaction');
    expect(runtime).toContain("status: 'DELIVERED'");
    expect(runtime).toContain('combinedBillingId: null');
    expect(runtime).toContain('allSameCustomer');
    expect(runtime).toContain('new Prisma.Decimal(0)');
    expect(runtime).toContain('combinedBillingDocument.create');
    expect(runtime).toContain("data: { status: 'FINALIZED' }");
  });

  test('module-local prisma adapter remains explicit', () => {
    const adapter = read('src/modules/finance/combined-billing/lib/prisma.js');
    expect(adapter).toContain("require('../../../../../lib/prisma')");
  });
});
