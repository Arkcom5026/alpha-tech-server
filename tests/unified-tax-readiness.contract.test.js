'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { routeFor, normalizeException } = require('../src/modules/tax/readiness/unifiedTaxReadinessService');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('unified readiness composes six existing tax authority domains', () => {
  const source = read('src/modules/tax/readiness/unifiedTaxReadinessService.js');
  for (const domain of ['OUTPUT_VAT', 'INPUT_VAT', 'TAX_EXPENSE', 'WITHHOLDING_TAX', 'PP30', 'TAX_PERIOD']) {
    assert.match(source, new RegExp(`key: '${domain}'`));
  }
  assert.match(source, /readyForAccountant/);
  assert.match(source, /readinessPercent/);
});

test('unified readiness reuses closing WHT and settlement authorities without legacy WHT duplication', () => {
  const source = read('src/modules/tax/readiness/unifiedTaxReadinessService.js');
  assert.match(source, /loadAccountingOfficePackage/);
  assert.match(source, /loadWithholdingTaxWorkspace/);
  assert.match(source, /loadVatSettlementPreparation/);
  assert.match(source, /LEGACY_WHT_CODES/);
  assert.match(source, /SETTLEMENT_DUPLICATES/);
});

test('exception targets resolve to source workspaces', () => {
  assert.equal(routeFor({ code: 'TAX_EXPENSE_ASSESSMENT_PENDING', source: 'TAX_EXPENSE' }, 'p1'), 'tax-expenses');
  assert.equal(routeFor({ code: 'WHT_CERTIFICATE_NOT_ISSUED', source: 'WHT_CERTIFICATE' }, 'p1'), 'tax-periods/p1/withholding-tax');
  assert.equal(routeFor({ code: 'VAT_SETTLEMENT_CARRY_FORWARD_AUTHORITY_REQUIRED', source: 'PRIOR_PERIOD_VAT_CREDIT' }, 'p1'), 'tax-periods/p1/vat-settlement');
  assert.equal(routeFor({ code: 'INPUT_VAT_PERIOD_UNBOUND', source: 'INPUT_VAT' }, 'p1'), 'input-tax-receipts');
  assert.equal(routeFor({ code: 'OUTPUT_VAT_PERIOD_UNBOUND', source: 'OUTPUT_VAT' }, 'p1'), 'output-tax-filings');
});

test('blocking severity is normalized for one UI contract', () => {
  const entry = normalizeException({ code: 'WHT_TEST', source: 'WHT_FILING', severity: 'BLOCKING', count: 2 }, 'p1', 'WITHHOLDING_TAX_WORKSPACE');
  assert.equal(entry.severity, 'BLOCKER');
  assert.equal(entry.count, 2);
  assert.equal(entry.target.relativePath, 'tax-periods/p1/withholding-tax');
});

test('tax router exposes unified readiness endpoint', () => {
  const routes = read('src/modules/tax/periods/taxPeriodRoutes.js');
  assert.match(routes, /tax-readiness\/:taxPeriodId/);
  assert.match(routes, /unifiedTaxReadinessController\.getWorkspace/);
});
