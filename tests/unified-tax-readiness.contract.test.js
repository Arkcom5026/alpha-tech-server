'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { routeFor, normalizeException } = require('../src/modules/tax/readiness/unifiedTaxReadinessService');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('unified readiness composes eight tax closing authority domains', () => {
  const source = read('src/modules/tax/readiness/unifiedTaxReadinessService.js');
  for (const domain of ['OUTPUT_VAT', 'INPUT_VAT', 'TAX_EXPENSE', 'WITHHOLDING_TAX', 'DOCUMENTS', 'RECONCILIATION', 'PP30', 'TAX_PERIOD']) {
    assert.match(source, new RegExp(`key: '${domain}'`));
  }
  assert.match(source, /documentsReady/);
  assert.match(source, /inputVatReady/);
  assert.match(source, /reconciliationReady/);
  assert.match(source, /readyForAccountant/);
  assert.match(source, /readinessPercent/);
});

test('unified readiness blocks active input tax documents that do not yet have Input VAT authority', () => {
  const source = read('src/modules/tax/readiness/unifiedTaxReadinessService.js');
  assert.match(source, /loadPendingInputVatApproval/);
  assert.match(source, /LEFT JOIN "InputVatRecord" record/);
  assert.match(source, /document\."documentType" = 'INPUT_TAX_INVOICE'/);
  assert.match(source, /document\."status" IN \('DRAFT', 'REGISTERED', 'UNDER_REVIEW', 'APPROVED'\)/);
  assert.match(source, /record\."id" IS NULL/);
  assert.match(source, /INPUT_VAT_DOCUMENT_APPROVAL_REQUIRED/);
  assert.match(source, /pendingInputVatApproval\.count === 0/);
  assert.match(source, /INPUT_VAT_FILING_CODES/);
});

test('unified readiness reuses closing WHT and settlement authorities without duplicate blockers', () => {
  const source = read('src/modules/tax/readiness/unifiedTaxReadinessService.js');
  assert.match(source, /loadAccountingOfficePackage/);
  assert.match(source, /loadWithholdingTaxWorkspace/);
  assert.match(source, /loadVatSettlementPreparation/);
  assert.match(source, /LEGACY_WHT_CODES/);
  assert.match(source, /SETTLEMENT_DUPLICATES/);
});

test('expense readiness counts only VAT and CIT assessment while WHT remains separate', () => {
  const source = read('src/modules/tax/readiness/unifiedTaxReadinessService.js');
  assert.match(source, /loadPendingVatCitExpenses/);
  assert.match(source, /item\."vatTreatment" = 'PENDING_REVIEW'/);
  assert.match(source, /item\."citTreatment" = 'PENDING_REVIEW'/);
  const queryBlock = source.match(/loadPendingVatCitExpenses[\s\S]*?return Object\.freeze/)?.[0] || '';
  assert.doesNotMatch(queryBlock, /whtTreatment/);
  assert.match(source, /TAX_EXPENSE_VAT_CIT_ASSESSMENT_PENDING/);
  assert.match(source, /LEGACY_EXPENSE_CODES/);
  assert.match(source, /LIMIT 20/);
});

test('exception targets resolve to source workspaces and exact expense review when available', () => {
  assert.equal(routeFor({ code: 'TAX_EXPENSE_VAT_CIT_ASSESSMENT_PENDING', source: 'TAX_EXPENSE', taxExpenseId: 41 }, 'p1'), 'tax-expenses?assessmentExpenseId=41');
  assert.equal(routeFor({ code: 'TAX_EXPENSE_EVIDENCE_INCOMPLETE', source: 'TAX_EXPENSE' }, 'p1'), 'tax-expenses');
  assert.equal(routeFor({ code: 'WHT_CERTIFICATE_NOT_ISSUED', source: 'WHT_CERTIFICATE' }, 'p1'), 'tax-periods/p1/withholding-tax');
  assert.equal(routeFor({ code: 'VAT_SETTLEMENT_CARRY_FORWARD_AUTHORITY_REQUIRED', source: 'PRIOR_PERIOD_VAT_CREDIT' }, 'p1'), 'tax-periods/p1/vat-settlement');
  assert.equal(routeFor({ code: 'INPUT_VAT_DOCUMENT_APPROVAL_REQUIRED', source: 'INPUT_VAT' }, 'p1'), 'tax-periods/p1/input-vat-filing');
  assert.equal(routeFor({ code: 'INPUT_VAT_FILING_NOT_PREPARED', source: 'INPUT_VAT' }, 'p1'), 'tax-periods/p1/input-vat-filing');
  assert.equal(routeFor({ code: 'INPUT_VAT_FILING_INCOMPLETE', source: 'INPUT_VAT' }, 'p1'), 'tax-periods/p1/input-vat-filing');
  assert.equal(routeFor({ code: 'INPUT_VAT_PERIOD_UNBOUND', source: 'INPUT_VAT' }, 'p1'), 'input-tax-receipts');
  assert.equal(routeFor({ code: 'OUTPUT_VAT_PERIOD_UNBOUND', source: 'OUTPUT_VAT' }, 'p1'), 'output-tax-filings');
});

test('blocking severity and source references are normalized for one UI contract', () => {
  const entry = normalizeException({ code: 'WHT_TEST', source: 'WHT_FILING', severity: 'BLOCKING', count: 2, sourceRefs: [7, 8] }, 'p1', 'WITHHOLDING_TAX_WORKSPACE');
  assert.equal(entry.severity, 'BLOCKER');
  assert.equal(entry.count, 2);
  assert.deepEqual(entry.sourceRefs, [7, 8]);
  assert.equal(entry.target.relativePath, 'tax-periods/p1/withholding-tax');
});

test('tax router exposes unified readiness endpoint', () => {
  const routes = read('src/modules/tax/periods/taxPeriodRoutes.js');
  assert.match(routes, /tax-readiness\/:taxPeriodId/);
  assert.match(routes, /unifiedTaxReadinessController\.getWorkspace/);
});
