const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const requireTransactionClient = (db) => {
  const requiredModels = ['taxDocument', 'taxLedgerEntry'];
  const missingModels = requiredModels.filter((modelName) => !db?.[modelName]);

  if (missingModels.length > 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_LEDGER_PERSISTENCE_CLIENT',
      'Tax ledger persistence requires a Prisma transaction client',
      { missingModels },
    );
  }

  return db;
};

const toTime = (value) => new Date(value).getTime();
const toAmount = (value) => Number(value);

const assertDocumentBranch = ({ taxDocument, entry }) => {
  if (!taxDocument) {
    throw new TaxDocumentContractError(
      'TAX_LEDGER_DOCUMENT_NOT_FOUND',
      'Tax ledger entry requires an existing tax document',
      { taxDocumentId: entry.taxDocumentId },
    );
  }

  if (taxDocument.branchId !== entry.branchId) {
    throw new TaxDocumentContractError(
      'TAX_LEDGER_DOCUMENT_BRANCH_MISMATCH',
      'Tax ledger entry must remain in the tax document branch',
      {
        taxDocumentId: entry.taxDocumentId,
        documentBranchId: taxDocument.branchId,
        requestedBranchId: entry.branchId,
      },
    );
  }
};

const replayMatches = (existing, entry) =>
  existing.branchId === entry.branchId &&
  existing.taxPeriodId === (entry.taxPeriodId ?? null) &&
  existing.ledgerType === entry.ledgerType &&
  toTime(existing.postingDate) === toTime(entry.postingDate) &&
  toTime(existing.effectiveDate) === toTime(entry.effectiveDate) &&
  (existing.reportingDate === null
    ? entry.reportingDate === null
    : toTime(existing.reportingDate) === toTime(entry.reportingDate)) &&
  toAmount(existing.taxBase) === toAmount(entry.taxBase) &&
  toAmount(existing.vatAmount) === toAmount(entry.vatAmount) &&
  toAmount(existing.totalAmount) === toAmount(entry.totalAmount) &&
  existing.version === entry.version;

const assertReplay = ({ existing, entry }) => {
  if (!replayMatches(existing, entry)) {
    throw new TaxDocumentContractError(
      'TAX_LEDGER_REPLAY_CONFLICT',
      'Existing tax ledger entry does not match the requested projection',
      {
        taxDocumentId: entry.taxDocumentId,
        ledgerType: entry.ledgerType,
        existingLedgerEntryId: existing.id,
      },
    );
  }
};

const selectLedgerEntry = {
  id: true,
  taxDocumentId: true,
  branchId: true,
  taxPeriodId: true,
  ledgerType: true,
  postingDate: true,
  effectiveDate: true,
  reportingDate: true,
  taxBase: true,
  vatAmount: true,
  totalAmount: true,
  version: true,
};

const createPrismaTaxLedgerPublisher = ({ db }) => {
  const tx = requireTransactionClient(db);

  const publish = async (entry) => {
    if (!entry?.taxDocumentId || !entry?.ledgerType) {
      throw new TaxDocumentContractError(
        'INVALID_TAX_LEDGER_ENTRY_DRAFT',
        'Tax ledger entry draft is incomplete',
      );
    }

    const taxDocument = await tx.taxDocument.findUnique({
      where: { id: entry.taxDocumentId },
      select: { id: true, branchId: true },
    });
    assertDocumentBranch({ taxDocument, entry });

    const existing = await tx.taxLedgerEntry.findFirst({
      where: {
        taxDocumentId: entry.taxDocumentId,
        ledgerType: entry.ledgerType,
      },
      select: selectLedgerEntry,
    });

    if (existing) {
      assertReplay({ existing, entry });
      return Object.freeze({ created: false, replayed: true, ledgerEntry: existing });
    }

    const ledgerEntry = await tx.taxLedgerEntry.create({
      data: {
        taxDocumentId: entry.taxDocumentId,
        branchId: entry.branchId,
        taxPeriodId: entry.taxPeriodId ?? null,
        ledgerType: entry.ledgerType,
        postingDate: entry.postingDate,
        effectiveDate: entry.effectiveDate,
        reportingDate: entry.reportingDate ?? null,
        taxBase: entry.taxBase,
        vatAmount: entry.vatAmount,
        totalAmount: entry.totalAmount,
        version: entry.version,
      },
      select: selectLedgerEntry,
    });

    return Object.freeze({ created: true, replayed: false, ledgerEntry });
  };

  return Object.freeze({ publish });
};

module.exports = {
  assertDocumentBranch,
  assertReplay,
  createPrismaTaxLedgerPublisher,
  replayMatches,
};
