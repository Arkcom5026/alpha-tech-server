const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const selectAssignedLedgerEntry = {
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

const requireAssignmentClient = (db) => {
  if (
    !db?.taxLedgerEntry ||
    typeof db.taxLedgerEntry.findUnique !== 'function' ||
    typeof db.taxLedgerEntry.updateMany !== 'function'
  ) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_LEDGER_PERIOD_ASSIGNMENT_CLIENT',
      'Tax ledger period assignment requires a Prisma taxLedgerEntry client',
    );
  }

  return db;
};

const createPrismaTaxLedgerPeriodAssignmentRepository = ({ db }) => {
  const tx = requireAssignmentClient(db);

  const findById = async (ledgerEntryId) =>
    tx.taxLedgerEntry.findUnique({
      where: { id: ledgerEntryId },
      select: selectAssignedLedgerEntry,
    });

  const assign = async ({ ledgerEntry, taxPeriod, reportingDate }) => {
    const changed = await tx.taxLedgerEntry.updateMany({
      where: {
        id: ledgerEntry.id,
        branchId: ledgerEntry.branchId,
        version: ledgerEntry.version,
        taxPeriodId: null,
      },
      data: {
        taxPeriodId: taxPeriod.id,
        reportingDate,
        version: { increment: 1 },
      },
    });

    if (changed.count !== 1) {
      throw new TaxDocumentContractError(
        'TAX_LEDGER_PERIOD_ASSIGNMENT_CONFLICT',
        'Tax ledger entry changed before period assignment could be committed',
        {
          ledgerEntryId: ledgerEntry.id,
          expectedVersion: ledgerEntry.version,
          taxPeriodId: taxPeriod.id,
        },
      );
    }

    return findById(ledgerEntry.id);
  };

  return Object.freeze({
    assign,
    findById,
  });
};

module.exports = {
  createPrismaTaxLedgerPeriodAssignmentRepository,
  requireAssignmentClient,
  selectAssignedLedgerEntry,
};
