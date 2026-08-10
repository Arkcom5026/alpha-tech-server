'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('accounting office package projects output VAT authority', () => {
  const source = read('src/modules/tax/accountingOffice/accountingOfficePackageService.js');
  assert.match(source, /FROM "OutputVatRecord" record/);
  assert.match(source, /JOIN "TaxDocument" document/);
  assert.match(source, /'OUTPUT_VAT'::"TaxLedgerType"/);
  assert.match(source, /'OUTPUT_VAT_ADJUSTMENT'::"TaxLedgerType"/);
  assert.doesNotMatch(source, /FROM "Sale"/);
});

test('monthly closing package projects input VAT authority and filing coverage', () => {
  const source = read('src/modules/tax/accountingOffice/accountingOfficePackageService.js');
  assert.match(source, /FROM "InputVatRecord" record/);
  assert.match(source, /FROM "InputTaxFilingBatch" batch/);
  assert.match(source, /'INPUT_VAT'::"TaxLedgerType"/);
  assert.match(source, /'INPUT_VAT_ADJUSTMENT'::"TaxLedgerType"/);
  assert.match(source, /inputFilingCoversAllDocuments/);
  assert.match(source, /inputVatReady/);
});

test('monthly closing package projects tax expense assessment and evidence readiness', () => {
  const source = read('src/modules/tax/accountingOffice/accountingOfficePackageService.js');
  assert.match(source, /FROM "TaxExpense" expense/);
  assert.match(source, /LEFT JOIN "TaxExpenseItem" item/);
  assert.match(source, /pendingAssessmentItemCount/);
  assert.match(source, /expensesClassified/);
  assert.match(source, /expenseEvidenceComplete/);
  assert.match(source, /expensesReady/);
});

test('accounting office package remains branch and period scoped across authorities', () => {
  const source = read('src/modules/tax/accountingOffice/accountingOfficePackageService.js');
  assert.match(source, /record\."branchId" = \$\{normalizedBranchId\}/);
  assert.match(source, /record\."documentDate" >= \$\{period\.startDate\}/);
  assert.match(source, /record\."documentDate" <= \$\{period\.endDate\}/);
  assert.match(source, /record\."taxPeriodId" IS NULL OR record\."taxPeriodId" = \$\{normalizedPeriodId\}/);
  assert.match(source, /expense\."branchId" = \$\{normalizedBranchId\}/);
  assert.match(source, /expense\."expenseDate" >= \$\{period\.startDate\}/);
  assert.match(source, /expense\."expenseDate" <= \$\{period\.endDate\}/);
});

test('credit note adjustments reduce output and input package totals', () => {
  const source = read('src/modules/tax/accountingOffice/accountingOfficePackageService.js');
  assert.match(source, /row\.ledgerType === 'OUTPUT_VAT_ADJUSTMENT' \? -1 : 1/);
  assert.match(source, /row\.ledgerType === 'INPUT_VAT_ADJUSTMENT' \? -1 : 1/);
  assert.match(source, /adjustmentCount/);
});

test('ready for accounting office requires output input expenses and locked period', () => {
  const source = read('src/modules/tax/accountingOffice/accountingOfficePackageService.js');
  assert.match(source, /readiness\.outputVatReady/);
  assert.match(source, /readiness\.inputVatReady/);
  assert.match(source, /readiness\.expensesReady/);
  assert.match(source, /readiness\.periodLockedOrSubmitted/);
  assert.match(source, /readyForAccountingOffice/);
  assert.match(source, /authority: 'MONTHLY_TAX_CLOSING_PACKAGE'/);
});

test('tax router exposes accounting office package endpoint', () => {
  const source = read('src/modules/tax/periods/taxPeriodRoutes.js');
  assert.match(source, /accounting-office\/packages\/:taxPeriodId/);
  assert.match(source, /accountingOfficeController\.getPackage/);
});
