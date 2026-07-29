const fs = require('fs');
const path = require('path');

describe('input tax report module runtime ownership', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

  test('root input tax report controller stays retired', () => {
    expect(exists('controllers/inputTaxReportController.js')).toBe(false);
  });

  test('active input tax route imports only module controller', () => {
    const route = read('src/modules/reporting/tax/input/routes/inputTaxReportRoutes.js');

    expect(route).toContain("require('../inputTaxReportController')");
    expect(route).not.toContain('controllers/inputTaxReportController');
    expect(route).toContain("router.get('/', getInputTaxReport)");
  });

  test('module runtime preserves branch, period, tax and decimal contracts', () => {
    const runtime = read('src/modules/reporting/tax/input/runtime/inputTaxReportRuntime.js');

    const requiredTokens = [
      'req.user?.branchId',
      'startDateText',
      'endDateText',
      'q.month',
      'q.year',
      'prisma.purchaseOrderReceipt.findMany',
      'supplierTaxInvoiceDate',
      'supplierTaxInvoiceNumber',
      'new Prisma.Decimal(0)',
      'vatAmountDec',
      'grandTotalDec',
      'summary',
      'module.exports = { getInputTaxReport }',
    ];

    for (const token of requiredTokens) {
      expect(runtime).toContain(token);
    }
  });

  test('module-local prisma adapter remains explicit', () => {
    const adapter = read('src/modules/reporting/tax/input/lib/prisma.js');
    expect(adapter).toContain("require('../../../../../../lib/prisma')");
  });
});
