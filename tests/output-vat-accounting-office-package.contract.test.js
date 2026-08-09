'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('accounting office package is projected from Output VAT authority', () => {
  const source = read('src/modules/tax/accountingOffice/accountingOfficePackageService.js');
  assert.match(source, /FROM "OutputVatRecord" record/);
  assert.match(source, /JOIN "TaxDocument" document/);
  assert.match(source, /'OUTPUT_VAT'::"TaxLedgerType"/);
  assert.match(source, /'OUTPUT_VAT_ADJUSTMENT'::"TaxLedgerType"/);
  assert.doesNotMatch(source, /FROM "Sale"/);
});

test('accounting office package remains branch and period scoped', () => {
  const source = read('src/modules/tax/accountingOffice/accountingOfficePackageService.js');
  assert.match(source, /record\."branchId" = \$\{normalizedBranchId\}/);
  assert.match(source, /record\."documentDate" >= \$\{period\.startDate\}/);
  assert.match(source, /record\."documentDate" <= \$\{period\.endDate\}/);
  assert.match(source, /record\."taxPeriodId" IS NULL OR record\."taxPeriodId" = \$\{normalizedPeriodId\}/);
});

test('credit note adjustments reduce package totals', () => {
  const source = read('src/modules/tax/accountingOffice/accountingOfficePackageService.js');
  assert.match(source, /row\.ledgerType === 'OUTPUT_VAT_ADJUSTMENT' \? -1 : 1/);
  assert.match(source, /adjustmentCount/);
});

test('readiness requires complete filing and locked-or-submitted period', () => {
  const source = read('src/modules/tax/accountingOffice/accountingOfficePackageService.js');
  assert.match(source, /filingCoversAllDocuments/);
  assert.match(source, /periodLockedOrSubmitted/);
  assert.match(source, /readyForAccountingOffice/);
});

test('tax router exposes accounting office package endpoint', () => {
  const source = read('src/modules/tax/periods/taxPeriodRoutes.js');
  assert.match(source, /accounting-office\/packages\/:taxPeriodId/);
  assert.match(source, /accountingOfficeController\.getPackage/);
});
