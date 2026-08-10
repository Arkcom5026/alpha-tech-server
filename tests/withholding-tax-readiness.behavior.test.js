'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveWithholdingTaxReadiness,
  normalizeWithholdingTaxWorkspace,
} = require('../src/modules/tax/withholdingTax/withholdingTaxReadiness');

test('no WHT source is ready without requiring an empty filing batch', () => {
  const readiness = deriveWithholdingTaxReadiness({ rows: [], filings: [], exceptions: [] });
  assert.equal(readiness.certificatesReady, true);
  assert.equal(readiness.filingsReady, true);
  assert.equal(readiness.readyForAccountant, true);
  assert.equal(readiness.hasWithholdingSource, false);
});

test('issued certificate without filing batch is not filing-ready when filing blocker exists', () => {
  const readiness = deriveWithholdingTaxReadiness({
    rows: [{ whtTreatment: 'WITHHELD', withholdingTaxAmount: 30, certificateStatus: 'ISSUED' }],
    filings: [],
    exceptions: [{ code: 'WHT_PND53_FILING_NOT_PREPARED', severity: 'BLOCKING' }],
  });
  assert.equal(readiness.certificatesReady, true);
  assert.equal(readiness.filingsReady, false);
  assert.equal(readiness.readyForAccountant, false);
  assert.equal(readiness.hasCertifiedSource, true);
});

test('prepared filing remains blocking until manual submission evidence is confirmed', () => {
  const readiness = deriveWithholdingTaxReadiness({
    rows: [{ whtTreatment: 'WITHHELD', withholdingTaxAmount: 30, certificateStatus: 'ISSUED' }],
    filings: [{ formType: 'PND53', itemCount: 1, status: 'PREPARED' }],
    exceptions: [{ code: 'WHT_PND53_FILING_NOT_SUBMITTED', severity: 'BLOCKING' }],
  });
  assert.equal(readiness.filingsReady, false);
  assert.equal(readiness.readyForAccountant, false);
});

test('submitted filing with no blocking exceptions is accountant-ready', () => {
  const workspace = normalizeWithholdingTaxWorkspace({
    authority: 'WITHHOLDING_TAX_WORKSPACE',
    rows: [{ whtTreatment: 'WITHHELD', withholdingTaxAmount: 30, certificateStatus: 'ISSUED' }],
    filings: [{ formType: 'PND53', itemCount: 1, status: 'SUBMITTED' }],
    exceptions: [],
  });
  assert.equal(workspace.readiness.certificatesReady, true);
  assert.equal(workspace.readiness.filingsReady, true);
  assert.equal(workspace.readiness.readyForAccountant, true);
  assert.equal(workspace.readiness.submittedFilingCount, 1);
});
