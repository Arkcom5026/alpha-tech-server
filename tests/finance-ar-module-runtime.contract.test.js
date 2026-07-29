const fs = require('fs');
const path = require('path');

describe('finance AR module runtime ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

  test('root finance controller stays retired', () => {
    expect(exists('controllers/financeController.js')).toBe(false);
  });

  test('finance compatibility route imports only module-owned controller', () => {
    const route = read('src/modules/finance/legacy-runtime/routes/financeRuntimeRoutes.js');
    expect(route).toContain("require('../../controllers/financeRuntimeController')");
    expect(route).not.toContain('controllers/financeController');
  });

  test('module runtime preserves AR and customer credit contracts', () => {
    const runtime = read('src/modules/finance/legacy-runtime/runtime/financeRuntime.js');
    const requiredExports = [
      'pingFinance',
      'getAccountsReceivableSummary',
      'getAccountsReceivableRows',
      'getCustomerCreditSummary',
      'getCustomerCreditRows',
      'getCustomerCreditByCustomerId',
    ];

    for (const name of requiredExports) {
      expect(runtime).toContain(name);
    }

    expect(runtime).toContain("require('../lib/prisma')");
  });
});
