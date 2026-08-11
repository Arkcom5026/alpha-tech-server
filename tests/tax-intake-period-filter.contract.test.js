'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const serviceSource = read('src', 'modules', 'tax', 'http', 'taxIntakeService.js');
const projectionSource = read('src', 'modules', 'tax', 'http', 'taxIntakePeriodProjectionRepository.js');
const readinessSource = read('src', 'modules', 'tax', 'readiness', 'unifiedTaxReadinessService.js');

test('tax intake period filter resolves branch-scoped TaxPeriod authority before listing', () => {
  assert.match(serviceSource, /taxPeriodRepository\.findById/);
  assert.match(serviceSource, /taxPeriodId:\s*normalizedTaxPeriodId/);
  assert.match(serviceSource, /periodProjectionRepository\.listCandidatesForPeriod/);
  assert.match(serviceSource, /periodProjectionRepository\.listDocumentsForPeriod/);
  assert.match(serviceSource, /startDate:\s*period\.startDate/);
  assert.match(serviceSource, /endDate:\s*period\.endDate/);
  assert.match(serviceSource, /code:\s*'TAX_PERIOD_NOT_FOUND'/);
});

test('period projection filters candidates and documents by authoritative occurredAt bounds', () => {
  assert.match(projectionSource, /candidate\."occurredAt" >= \$\{startDate\}/);
  assert.match(projectionSource, /candidate\."occurredAt" <= \$\{endDate\}/);
  assert.match(projectionSource, /document\."occurredAt" >= \$\{startDate\}/);
  assert.match(projectionSource, /document\."occurredAt" <= \$\{endDate\}/);
  assert.match(projectionSource, /Math\.min\(Math\.max\(Number\(limit\) \|\| 50, 1\), 200\)/);
});

test('unified readiness blocks period close on output drafts and deep-links to the same period filter', () => {
  assert.match(readinessSource, /const loadPendingOutputVatDrafts/);
  assert.match(readinessSource, /document\."documentType" = 'OUTPUT_TAX_INVOICE'/);
  assert.match(readinessSource, /document\."status" = 'DRAFT'/);
  assert.match(readinessSource, /code:\s*'OUTPUT_VAT_DRAFTS_REMAIN'/);
  assert.match(readinessSource, /tax-intake\?taxPeriodId=\$\{encodeURIComponent\(String\(taxPeriodId\)\)\}&documentStatus=DRAFT&documentType=OUTPUT_TAX_INVOICE/);
  assert.match(readinessSource, /pendingOutputVatDrafts\.count === 0/);
});
