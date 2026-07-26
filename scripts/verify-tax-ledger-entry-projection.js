const assert = require('node:assert/strict');
const {
  TAX_LEDGER_TYPES,
  TaxDocumentContractError,
  projectTaxDocumentDraftToLedgerEntry,
  resolveLedgerType,
} = require('../src/modules/tax');

const occurredAt = new Date('2026-07-26T10:00:00.000Z');

const createDraft = (overrides = {}) => ({
  document: {
    branchId: 2,
    ...(overrides.document || {}),
  },
  snapshot: {
    direction: 'OUTPUT',
    occurredAt,
    taxableAmount: 100,
    vatAmount: 7,
    totalAmount: 107,
    ...(overrides.snapshot || {}),
  },
});

const outputEntry = projectTaxDocumentDraftToLedgerEntry({
  taxDocument: { id: 'tax-doc-output', branchId: 2 },
  draft: createDraft(),
});

assert.equal(outputEntry.ledgerType, TAX_LEDGER_TYPES.OUTPUT_VAT);
assert.equal(outputEntry.branchId, 2);
assert.equal(outputEntry.taxDocumentId, 'tax-doc-output');
assert.equal(outputEntry.taxPeriodId, null);
assert.equal(outputEntry.reportingDate, null);
assert.equal(outputEntry.taxBase, 100);
assert.equal(outputEntry.vatAmount, 7);
assert.equal(outputEntry.totalAmount, 107);
assert.equal(outputEntry.postingDate.toISOString(), occurredAt.toISOString());
assert.equal(outputEntry.effectiveDate.toISOString(), occurredAt.toISOString());
assert.equal(Object.isFrozen(outputEntry), true);

const inputEntry = projectTaxDocumentDraftToLedgerEntry({
  taxDocument: { id: 'tax-doc-input', branchId: 5 },
  draft: createDraft({
    document: { branchId: 5 },
    snapshot: { direction: 'INPUT' },
  }),
  postingDate: '2026-07-27T00:00:00.000Z',
  effectiveDate: '2026-07-25T00:00:00.000Z',
});

assert.equal(inputEntry.ledgerType, TAX_LEDGER_TYPES.INPUT_VAT);
assert.equal(inputEntry.postingDate.toISOString(), '2026-07-27T00:00:00.000Z');
assert.equal(inputEntry.effectiveDate.toISOString(), '2026-07-25T00:00:00.000Z');
assert.equal(resolveLedgerType('OUTPUT'), TAX_LEDGER_TYPES.OUTPUT_VAT);
assert.equal(resolveLedgerType('INPUT'), TAX_LEDGER_TYPES.INPUT_VAT);

assert.throws(
  () =>
    projectTaxDocumentDraftToLedgerEntry({
      taxDocument: { id: 'cross-branch', branchId: 2 },
      draft: createDraft({ document: { branchId: 5 } }),
    }),
  (error) =>
    error instanceof TaxDocumentContractError &&
    error.code === 'TAX_LEDGER_BRANCH_MISMATCH',
);

assert.throws(
  () =>
    projectTaxDocumentDraftToLedgerEntry({
      taxDocument: { id: 'invalid-direction', branchId: 2 },
      draft: createDraft({ snapshot: { direction: 'UNKNOWN' } }),
    }),
  (error) =>
    error instanceof TaxDocumentContractError &&
    error.code === 'INVALID_TAX_LEDGER_DIRECTION',
);

assert.throws(
  () =>
    projectTaxDocumentDraftToLedgerEntry({
      taxDocument: { id: 'negative-vat', branchId: 2 },
      draft: createDraft({ snapshot: { vatAmount: -1 } }),
    }),
  (error) =>
    error instanceof TaxDocumentContractError &&
    error.code === 'INVALID_TAX_LEDGER_PROJECTION',
);

console.log('Tax ledger entry projection verification: PASS');
