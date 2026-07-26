const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const TAX_LEDGER_TYPES = Object.freeze({
  OUTPUT_VAT: 'OUTPUT_VAT',
  INPUT_VAT: 'INPUT_VAT',
});

const requireObject = (value, field) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_LEDGER_PROJECTION',
      `${field} must be an object`,
      { field },
    );
  }
  return value;
};

const requirePositiveInteger = (value, field) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_LEDGER_PROJECTION',
      `${field} must be a positive integer`,
      { field, value },
    );
  }
  return value;
};

const requireNonEmptyString = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_LEDGER_PROJECTION',
      `${field} must be a non-empty string`,
      { field },
    );
  }
  return value;
};

const requireAmount = (value, field) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_LEDGER_PROJECTION',
      `${field} must be a finite non-negative amount`,
      { field, value },
    );
  }
  return amount;
};

const requireDate = (value, field) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_LEDGER_PROJECTION',
      `${field} must be a valid date`,
      { field, value },
    );
  }
  return date;
};

const resolveLedgerType = (direction) => {
  if (direction === 'OUTPUT') return TAX_LEDGER_TYPES.OUTPUT_VAT;
  if (direction === 'INPUT') return TAX_LEDGER_TYPES.INPUT_VAT;
  throw new TaxDocumentContractError(
    'INVALID_TAX_LEDGER_DIRECTION',
    'Tax ledger projection requires OUTPUT or INPUT direction',
    { direction },
  );
};

const projectTaxDocumentDraftToLedgerEntry = ({
  taxDocument,
  draft,
  postingDate = null,
  effectiveDate = null,
}) => {
  requireObject(taxDocument, 'taxDocument');
  requireObject(draft, 'draft');
  requireObject(draft.document, 'draft.document');
  requireObject(draft.snapshot, 'draft.snapshot');

  const taxDocumentId = requireNonEmptyString(taxDocument.id, 'taxDocument.id');
  const persistedBranchId = requirePositiveInteger(
    taxDocument.branchId,
    'taxDocument.branchId',
  );
  const draftBranchId = requirePositiveInteger(
    draft.document.branchId,
    'draft.document.branchId',
  );

  if (persistedBranchId !== draftBranchId) {
    throw new TaxDocumentContractError(
      'TAX_LEDGER_BRANCH_MISMATCH',
      'Tax ledger entry must remain in the tax document branch',
      {
        taxDocumentId,
        persistedBranchId,
        requestedBranchId: draftBranchId,
      },
    );
  }

  const occurredAt = requireDate(draft.snapshot.occurredAt, 'draft.snapshot.occurredAt');

  return Object.freeze({
    taxDocumentId,
    branchId: persistedBranchId,
    taxPeriodId: null,
    ledgerType: resolveLedgerType(draft.snapshot.direction),
    postingDate: requireDate(postingDate || occurredAt, 'postingDate'),
    effectiveDate: requireDate(effectiveDate || occurredAt, 'effectiveDate'),
    reportingDate: null,
    taxBase: requireAmount(draft.snapshot.taxableAmount, 'draft.snapshot.taxableAmount'),
    vatAmount: requireAmount(draft.snapshot.vatAmount, 'draft.snapshot.vatAmount'),
    totalAmount: requireAmount(draft.snapshot.totalAmount, 'draft.snapshot.totalAmount'),
    version: 1,
  });
};

module.exports = {
  TAX_LEDGER_TYPES,
  projectTaxDocumentDraftToLedgerEntry,
  resolveLedgerType,
};
