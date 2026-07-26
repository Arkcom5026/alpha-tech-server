const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const TAX_PERIOD_INITIAL_STATUS = 'OPEN';

const padMonth = (month) => String(month).padStart(2, '0');

const requirePositiveBranchId = (branchId) => {
  if (!Number.isInteger(branchId) || branchId <= 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_BRANCH',
      'Tax period creation requires a positive branchId',
      { branchId },
    );
  }

  return branchId;
};

const requireYear = (year) => {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_YEAR',
      'Tax period year must be an integer between 2000 and 9999',
      { year },
    );
  }

  return year;
};

const requireMonth = (month) => {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_MONTH',
      'Tax period month must be an integer between 1 and 12',
      { month },
    );
  }

  return month;
};

const buildMonthlyTaxPeriodBoundary = ({ year, month }) => {
  const resolvedYear = requireYear(year);
  const resolvedMonth = requireMonth(month);
  const startDate = new Date(Date.UTC(resolvedYear, resolvedMonth - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(resolvedYear, resolvedMonth, 1, 0, 0, 0, 0) - 1);

  return Object.freeze({
    year: resolvedYear,
    month: resolvedMonth,
    periodCode: `${resolvedYear}-${padMonth(resolvedMonth)}`,
    startDate,
    endDate,
    status: TAX_PERIOD_INITIAL_STATUS,
  });
};

const normalizeCreateMonthlyTaxPeriodCommand = ({ branchId, year, month } = {}) => {
  const boundary = buildMonthlyTaxPeriodBoundary({ year, month });

  return Object.freeze({
    branchId: requirePositiveBranchId(branchId),
    ...boundary,
  });
};

const sameBoundary = (period, command) =>
  period.branchId === command.branchId &&
  period.periodCode === command.periodCode &&
  new Date(period.startDate).getTime() === command.startDate.getTime() &&
  new Date(period.endDate).getTime() === command.endDate.getTime();

const assertTaxPeriodReplay = ({ period, command }) => {
  if (!sameBoundary(period, command)) {
    throw new TaxDocumentContractError(
      'TAX_PERIOD_CODE_CONFLICT',
      'Existing tax period code does not match the requested monthly boundary',
      {
        branchId: command.branchId,
        periodCode: command.periodCode,
        existingTaxPeriodId: period.id,
      },
    );
  }

  return period;
};

module.exports = {
  TAX_PERIOD_INITIAL_STATUS,
  assertTaxPeriodReplay,
  buildMonthlyTaxPeriodBoundary,
  normalizeCreateMonthlyTaxPeriodCommand,
  sameBoundary,
};