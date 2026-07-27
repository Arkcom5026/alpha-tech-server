'use strict';

const assert = require('assert');
const tax = require('../src/modules/tax');

const candidate = tax.candidates.contracts.buildTaxCandidateRegistration({
  branchId: 1,
  sourceType: 'SALE',
  sourceId: 42,
  sourceDocumentNo: 'INV-00042',
  occurredAt: '2026-07-27T00:00:00.000Z',
  snapshot: { totalAmount: 1070, vatAmount: 70 },
});

assert.strictEqual(candidate.registrationKey, '1:SALE:42');
assert.strictEqual(candidate.status, 'REGISTERED');

const draft = tax.candidates.mapping.mapCandidateToTaxDocumentDraft({ candidate });
assert.strictEqual(draft.documentType, 'OUTPUT_TAX_INVOICE');
assert.strictEqual(draft.documentNumber, 'INV-00042');
assert.strictEqual(draft.status, 'DRAFT');
assert.strictEqual(draft.sourceCandidateKey, candidate.registrationKey);

const registered = tax.documents.lifecycle.assertTaxDocumentTransition({
  currentStatus: 'DRAFT',
  targetStatus: 'REGISTERED',
});
assert.strictEqual(registered.allowed, true);
assert.strictEqual(registered.replayed, false);

const replay = tax.documents.lifecycle.assertTaxDocumentTransition({
  currentStatus: 'REGISTERED',
  targetStatus: 'REGISTERED',
});
assert.strictEqual(replay.replayed, true);

assert.throws(
  () => tax.documents.lifecycle.assertTaxDocumentTransition({ currentStatus: 'DRAFT', targetStatus: 'APPROVED' }),
  (error) => error.code === 'TAX_DOCUMENT_TRANSITION_FORBIDDEN',
);

assert.throws(
  () => tax.candidates.contracts.buildTaxCandidateRegistration({ branchId: 1, sourceType: 'UNKNOWN', sourceId: 1 }),
  (error) => error.code === 'TAX_CANDIDATE_SOURCE_TYPE_INVALID',
);

console.log('Tax Intake Foundation STEP 001-004 contract tests: PASS');
