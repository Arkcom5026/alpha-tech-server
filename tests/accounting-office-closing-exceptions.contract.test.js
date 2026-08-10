'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildClosingExceptions } = require('../src/modules/tax/accountingOffice/accountingOfficePackageExceptions');

const readyInput = () => ({
  period: { status: 'LOCKED' },
  outputUnboundCount: 0,
  outputFilingPrepared: true,
  outputFilingCoversAllDocuments: true,
  inputUnboundCount: 0,
  inputFilingPrepared: true,
  inputFilingCoversAllDocuments: true,
  pendingAssessmentCount: 0,
  missingEvidenceCount: 0,
  withholdingPendingCount: 0,
  missingWithholdingCertificateCount: 0,
});

test('returns no blockers when monthly closing package is ready', () => {
  assert.deepEqual(buildClosingExceptions(readyInput()), []);
});

test('projects source-specific blocker counts for accountant handoff', () => {
  const exceptions = buildClosingExceptions({
    ...readyInput(),
    outputUnboundCount: 2,
    inputFilingCoversAllDocuments: false,
    pendingAssessmentCount: 3,
    missingWithholdingCertificateCount: 1,
    period: { status: 'CLOSED' },
  });

  assert.deepEqual(exceptions.map(({ code, source, severity, count }) => ({ code, source, severity, count })), [
    { code: 'OUTPUT_VAT_PERIOD_UNBOUND', source: 'OUTPUT_VAT', severity: 'BLOCKER', count: 2 },
    { code: 'INPUT_VAT_FILING_INCOMPLETE', source: 'INPUT_VAT', severity: 'BLOCKER', count: 1 },
    { code: 'TAX_EXPENSE_ASSESSMENT_PENDING', source: 'TAX_EXPENSE', severity: 'BLOCKER', count: 3 },
    { code: 'WITHHOLDING_CERTIFICATE_MISSING', source: 'WITHHOLDING_TAX', severity: 'BLOCKER', count: 1 },
    { code: 'TAX_PERIOD_NOT_LOCKED', source: 'TAX_PERIOD', severity: 'BLOCKER', count: 1 },
  ]);
});

test('does not duplicate filing missing and incomplete blockers', () => {
  const exceptions = buildClosingExceptions({
    ...readyInput(),
    outputFilingPrepared: false,
    outputFilingCoversAllDocuments: false,
    inputFilingPrepared: false,
    inputFilingCoversAllDocuments: false,
  });
  assert.deepEqual(exceptions.map((entry) => entry.code), [
    'OUTPUT_VAT_FILING_NOT_PREPARED',
    'INPUT_VAT_FILING_NOT_PREPARED',
  ]);
});
