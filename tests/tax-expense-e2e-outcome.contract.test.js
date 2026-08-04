'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'verify-tax-expense-e2e-outcome.js'),
  'utf8',
);

assert.match(source, /assertTestDatabaseAuthority/);
assert.match(source, /BEGIN READ ONLY/);
assert.match(source, /databaseModified:\s*false/);
assert.match(source, /"TaxExpense"/);
assert.match(source, /"TaxExpenseItem"/);
assert.match(source, /"TaxExpenseCategory"/);
assert.match(source, /"TaxExpenseLifecycleEvent"/);
assert.match(source, /BRANCH_ID_MISMATCH/);
assert.match(source, /SUPPLIER_BRANCH_MISMATCH/);
assert.match(source, /CROSS_BRANCH_ITEM/);
assert.match(source, /CROSS_BRANCH_CATEGORY/);
assert.match(source, /SUBTOTAL_MISMATCH/);
assert.match(source, /VAT_MISMATCH/);
assert.match(source, /WITHHOLDING_MISMATCH/);
assert.match(source, /TOTAL_MISMATCH/);
assert.match(source, /PAYMENT_DUE_MISMATCH/);
assert.match(source, /RECORDED_LIFECYCLE_MISSING/);
assert.doesNotMatch(source, /\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b/i);

console.log('Tax Expense E2E outcome contract: PASS');
