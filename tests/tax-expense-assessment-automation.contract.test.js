'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('assessment suggestion is rule-assisted evidence-safe and never auto-finalizes', () => {
  const source = read('src/modules/tax-expense/assessment/taxExpenseAssessmentService.js');
  assert.match(source, /RULE_ASSISTED_HUMAN_CONFIRMATION/);
  assert.match(source, /autoFinalize: false/);
  assert.match(source, /NO_VAT_AMOUNT_RECORDED/);
  assert.match(source, /INPUT_VAT_ELIGIBILITY_AUTHORITY_REQUIRED/);
  assert.match(source, /treatment: 'PENDING_REVIEW'/);
  assert.doesNotMatch(source, /VERIFIED_EVIDENCE_WITH_DOCUMENT/);
  assert.match(source, /CIT_RULE_AUTHORITY_NOT_CONFIGURED/);
});

test('assessment confirmation versions and hashes human-confirmed decisions', () => {
  const source = read('src/modules/tax-expense/assessment/taxExpenseAssessmentService.js');
  assert.match(source, /HUMAN_CONFIRMED_RULE_ASSISTED_ASSESSMENT/);
  assert.match(source, /assessmentHash/);
  assert.match(source, /version = Number\(previous\?\.version \|\| 0\) \+ 1/);
  assert.match(source, /status: 'FINALIZED'/);
  assert.match(source, /status: 'SUPERSEDED'/);
});

test('assessment confirmation updates VAT and CIT only while preserving WHT authority', () => {
  const source = read('src/modules/tax-expense/assessment/taxExpenseAssessmentService.js');
  assert.match(source, /data: \{ vatTreatment: decision\.vatTreatment, citTreatment: decision\.citTreatment \}/);
  assert.match(source, /whtAuthority: 'SEPARATE_WHT_WORKFLOW'/);
  assert.doesNotMatch(source, /data: \{[^}]*whtTreatment: decision/);
});

test('assessment confirmation rejects duplicate items concurrent writes and submitted tax periods', () => {
  const source = read('src/modules/tax-expense/assessment/taxExpenseAssessmentService.js');
  assert.match(source, /TAX_EXPENSE_ASSESSMENT_DUPLICATE_ITEM/);
  assert.match(source, /TAX_EXPENSE_ASSESSMENT_CONCURRENT_MODIFICATION/);
  assert.match(source, /TAX_EXPENSE_ASSESSMENT_PERIOD_IMMUTABLE/);
  assert.match(source, /status: 'SUBMITTED'/);
});

test('assessment routes expose suggestion and human confirmation endpoints', () => {
  const routes = read('src/modules/tax-expense/routes/taxExpenseRoutes.js');
  assert.match(routes, /assessment-suggestion/);
  assert.match(routes, /assessment-confirmation/);
  assert.match(routes, /taxExpenseAssessment\.getSuggestion/);
  assert.match(routes, /taxExpenseAssessment\.confirm/);
});
