const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const TAX_PERIOD_ASSIGNABLE_STATUSES = Object.freeze([
  'OPEN',
  'REOPENED',
]);

const requireDate = (value, field) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_RESOLUTION_DATE',
      `${field} must be a valid date`,
      { field, value },
    );
  }

  return date;
};

const resolveTaxPeriodDate = (ledgerEntry) => {
  if (!ledgerEntry || typeof ledgerEntry !== 'object') {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_LEDGER_ENTRY',
      'Tax period resolution requires a ledger entry',
    );
  }

  return requireDate(
    ledgerEntry.reportingDate || ledgerEntry.effectiveDate,
    ledgerEntry.reportingDate ? 'ledgerEntry.reportingDate' : 'ledgerEntry.effectiveDate',
  );
};

const isAssignableTaxPeriodStatus = (status) =>
  TAX_PERIOD_ASSIGNABLE_STATUSES.includes(status);

const periodContainsDate = ({ period, periodDate }) => {
  const startDate = requireDate(period?.startDate, 'period.startDate');
  const endDate = requireDate(period?.endDate, 'period.endDate');
  const targetDate = requireDate(periodDate, 'periodDate');

  return targetDate.getTime() >= startDate.getTime() &&
    targetDate.getTime() <= endDate.getTime();
};

const assertTaxPeriodCandidate = ({ ledgerEntry, period, periodDate }) => {
  if (!period) {
    throw new TaxDocumentContractError(
      'TAX_PERIOD_NOT_FOUND',
      'No assignable tax period covers the ledger entry date',
      {
        branchId: ledgerEntry?.branchId ?? null,
        periodDate: requireDate(periodDate, 'periodDate').toISOString(),
      },
    );
  }

  if (period.branchId !== ledgerEntry.branchId) {
    throw new TaxDocumentContractError(
      'TAX_PERIOD_BRANCH_MISMATCH',
      'Tax period must belong to the ledger entry branch',
      {
        taxPeriodId: period.id,
        periodBranchId: period.branchId,
        ledgerBranchId: ledgerEntry.branchId,
      },
    );
  }

  if (!isAssignableTaxPeriodStatus(period.status)) {
    throw new TaxDocumentContractError(
      'TAX_PERIOD_NOT_ASSIGNABLE',
      'Tax period status does not accept ledger assignment',
      {
        taxPeriodId: period.id,
        status: period.status,
      },
    );
  }

  if (!periodContainsDate({ period, periodDate })) {
    throw new TaxDocumentContractError(
      'TAX_PERIOD_DATE_OUTSIDE_BOUNDARY',
      'Tax period does not cover the ledger entry date',
      {
        taxPeriodId: period.id,
        periodDate: requireDate(periodDate, 'periodDate').toISOString(),
      },
    );
  }

  return period;
};

module.exports = {
  TAX_PERIOD_ASSIGNABLE_STATUSES,
  assertTaxPeriodCandidate,
  isAssignableTaxPeriodStatus,
  periodContainsDate,
  resolveTaxPeriodDate,
};
