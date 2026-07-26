const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');
const {
  TAX_PERIOD_STATUSES,
} = require('../policies/taxPeriodLifecyclePolicy');
const {
  createTaxPeriodAvailabilityService,
} = require('./taxPeriodAvailabilityService');
const {
  createTaxPeriodOperationalReadinessService,
} = require('./taxPeriodOperationalReadinessService');
const {
  createPrismaTaxPeriodAdministrativeRepository,
} = require('../infrastructure/prismaTaxPeriodAdministrativeRepository');

const requirePositiveInteger = (value, code, message) => {
  const resolved = Number(value);
  if (!Number.isInteger(resolved) || resolved <= 0) {
    throw new TaxDocumentContractError(code, message, { value });
  }
  return resolved;
};

const parseOptionalDate = (value, code) => {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TaxDocumentContractError(code, 'Tax period administrative date is invalid', { value });
  }
  return date;
};

const normalizeStatuses = (value) => {
  if (value === undefined || value === null || value === '') return [];
  const statuses = (Array.isArray(value) ? value : String(value).split(','))
    .map((status) => String(status).trim().toUpperCase())
    .filter(Boolean);
  const invalid = statuses.filter((status) => !TAX_PERIOD_STATUSES.includes(status));
  if (invalid.length > 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_ADMINISTRATIVE_STATUS',
      'Tax period administrative status filter is invalid',
      { invalidStatuses: invalid },
    );
  }
  return [...new Set(statuses)];
};

const createTaxPeriodAdministrativeService = ({ db }) => {
  const availability = createTaxPeriodAvailabilityService({ db });
  const readiness = createTaxPeriodOperationalReadinessService({ db });
  const repository = createPrismaTaxPeriodAdministrativeRepository({ db });

  const ensureMonthlyPeriod = (input) => availability.ensureMonthlyPeriod(input);
  const ensureOperationalReadiness = (input) => readiness.ensureOperationalReadiness(input);

  const listPeriods = async (input = {}) => {
    const branchId = requirePositiveInteger(
      input.branchId,
      'INVALID_TAX_PERIOD_ADMINISTRATIVE_BRANCH',
      'Tax period administration requires a positive branchId',
    );
    const fromDate = parseOptionalDate(input.fromDate, 'INVALID_TAX_PERIOD_ADMINISTRATIVE_FROM_DATE');
    const toDate = parseOptionalDate(input.toDate, 'INVALID_TAX_PERIOD_ADMINISTRATIVE_TO_DATE');
    if (fromDate && toDate && fromDate > toDate) {
      throw new TaxDocumentContractError(
        'INVALID_TAX_PERIOD_ADMINISTRATIVE_DATE_RANGE',
        'Tax period administrative fromDate must not be after toDate',
      );
    }

    const periods = await repository.list({
      branchId,
      fromDate,
      toDate,
      statuses: normalizeStatuses(input.statuses),
    });

    return Object.freeze({ branchId, count: periods.length, periods: Object.freeze(periods) });
  };

  return Object.freeze({ ensureMonthlyPeriod, ensureOperationalReadiness, listPeriods });
};

module.exports = {
  createTaxPeriodAdministrativeService,
  normalizeStatuses,
  parseOptionalDate,
  requirePositiveInteger,
};
