const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const {
  TAX_PERIOD_ASSIGNABLE_STATUSES,
  assertTaxPeriodCandidate,
  resolveTaxPeriodDate,
} = require('../policies/taxPeriodResolutionPolicy');

const requireTaxPeriodClient = (db) => {
  if (!db?.taxPeriod || typeof db.taxPeriod.findMany !== 'function') {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_RESOLUTION_CLIENT',
      'Tax period resolution requires a Prisma taxPeriod client',
    );
  }

  return db;
};

const requireLedgerEntry = (ledgerEntry) => {
  if (!ledgerEntry || typeof ledgerEntry !== 'object') {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_LEDGER_ENTRY',
      'Tax period resolution requires a ledger entry',
    );
  }

  if (!Number.isInteger(ledgerEntry.branchId) || ledgerEntry.branchId <= 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_LEDGER_BRANCH',
      'Tax period resolution requires a positive ledger branchId',
      { branchId: ledgerEntry.branchId },
    );
  }

  return ledgerEntry;
};

const createPrismaTaxPeriodResolver = ({ db }) => {
  const tx = requireTaxPeriodClient(db);

  const resolveForLedgerEntry = async (ledgerEntry) => {
    const resolvedLedgerEntry = requireLedgerEntry(ledgerEntry);
    const periodDate = resolveTaxPeriodDate(resolvedLedgerEntry);

    const periods = await tx.taxPeriod.findMany({
      where: {
        branchId: resolvedLedgerEntry.branchId,
        status: { in: [...TAX_PERIOD_ASSIGNABLE_STATUSES] },
        startDate: { lte: periodDate },
        endDate: { gte: periodDate },
      },
      orderBy: [
        { startDate: 'asc' },
        { endDate: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        branchId: true,
        periodCode: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    if (periods.length > 1) {
      throw new TaxDocumentContractError(
        'TAX_PERIOD_BOUNDARY_OVERLAP',
        'Multiple assignable tax periods cover the ledger entry date',
        {
          branchId: resolvedLedgerEntry.branchId,
          periodDate: periodDate.toISOString(),
          taxPeriodIds: periods.map((period) => period.id),
        },
      );
    }

    const period = assertTaxPeriodCandidate({
      ledgerEntry: resolvedLedgerEntry,
      period: periods[0] || null,
      periodDate,
    });

    return Object.freeze({
      periodDate,
      taxPeriod: Object.freeze({ ...period }),
    });
  };

  return Object.freeze({ resolveForLedgerEntry });
};

module.exports = {
  createPrismaTaxPeriodResolver,
  requireLedgerEntry,
  requireTaxPeriodClient,
};
