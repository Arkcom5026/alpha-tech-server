const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const {
  createPrismaTaxPeriodResolver,
} = require('../infrastructure/prismaTaxPeriodResolver');

const {
  createPrismaTaxLedgerPeriodAssignmentRepository,
} = require('../infrastructure/prismaTaxLedgerPeriodAssignmentRepository');

const requireLedgerEntryId = (ledgerEntryId) => {
  if (typeof ledgerEntryId !== 'string' || !ledgerEntryId.trim()) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_LEDGER_PERIOD_ASSIGNMENT_ID',
      'Tax ledger period assignment requires a ledger entry id',
    );
  }

  return ledgerEntryId.trim();
};

const sameDate = (left, right) =>
  new Date(left).getTime() === new Date(right).getTime();

const assertReplay = ({ ledgerEntry, resolution }) => {
  if (ledgerEntry.taxPeriodId !== resolution.taxPeriod.id) {
    throw new TaxDocumentContractError(
      'TAX_LEDGER_PERIOD_REASSIGNMENT_FORBIDDEN',
      'Tax ledger entry is already assigned to another tax period',
      {
        ledgerEntryId: ledgerEntry.id,
        existingTaxPeriodId: ledgerEntry.taxPeriodId,
        requestedTaxPeriodId: resolution.taxPeriod.id,
      },
    );
  }

  if (!ledgerEntry.reportingDate || !sameDate(ledgerEntry.reportingDate, resolution.periodDate)) {
    throw new TaxDocumentContractError(
      'TAX_LEDGER_REPORTING_DATE_CONFLICT',
      'Assigned tax ledger reporting date does not match the resolved period date',
      {
        ledgerEntryId: ledgerEntry.id,
        existingReportingDate: ledgerEntry.reportingDate,
        requestedReportingDate: resolution.periodDate,
      },
    );
  }
};

const createTaxLedgerPeriodAssignmentService = ({ db }) => {
  const resolver = createPrismaTaxPeriodResolver({ db });
  const repository = createPrismaTaxLedgerPeriodAssignmentRepository({ db });

  const assignLedgerEntry = async ({ ledgerEntryId }) => {
    const resolvedId = requireLedgerEntryId(ledgerEntryId);
    const ledgerEntry = await repository.findById(resolvedId);

    if (!ledgerEntry) {
      throw new TaxDocumentContractError(
        'TAX_LEDGER_ENTRY_NOT_FOUND',
        'Tax ledger entry was not found for period assignment',
        { ledgerEntryId: resolvedId },
      );
    }

    const resolution = await resolver.resolveForLedgerEntry(ledgerEntry);

    if (ledgerEntry.taxPeriodId) {
      assertReplay({ ledgerEntry, resolution });
      return Object.freeze({
        assigned: false,
        replayed: true,
        taxPeriod: resolution.taxPeriod,
        ledgerEntry: Object.freeze({ ...ledgerEntry }),
      });
    }

    const assignedLedgerEntry = await repository.assign({
      ledgerEntry,
      taxPeriod: resolution.taxPeriod,
      reportingDate: resolution.periodDate,
    });

    if (!assignedLedgerEntry) {
      throw new TaxDocumentContractError(
        'TAX_LEDGER_PERIOD_ASSIGNMENT_RESULT_MISSING',
        'Tax ledger period assignment committed without a readable ledger entry',
        { ledgerEntryId: ledgerEntry.id },
      );
    }

    return Object.freeze({
      assigned: true,
      replayed: false,
      taxPeriod: resolution.taxPeriod,
      ledgerEntry: Object.freeze({ ...assignedLedgerEntry }),
    });
  };

  return Object.freeze({ assignLedgerEntry });
};

module.exports = {
  assertReplay,
  createTaxLedgerPeriodAssignmentService,
  requireLedgerEntryId,
};
