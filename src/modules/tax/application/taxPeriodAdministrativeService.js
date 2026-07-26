const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');
const {
  TAX_PERIOD_STATUSES,
} = require('../policies/taxPeriodLifecyclePolicy');
const {
  projectTaxPeriodAdministrativeCollection,
  projectTaxPeriodAdministrativeResponse,
} = require('../projections/taxPeriodAdministrativeProjection');
const {
  createTaxPeriodAvailabilityService,
} = require('./taxPeriodAvailabilityService');
const {
  createTaxPeriodOperationalReadinessService,
} = require('./taxPeriodOperationalReadinessService');
const {
  createPrismaTaxPeriodAdministrativeRepository,
} = require('../infrastructure/prismaTaxPeriodAdministrativeRepository');

const TAX_PERIOD_STATUS_VALUES = Object.freeze(Object.values(TAX_PERIOD_STATUSES));

const requirePositiveInteger = (value, code, message) => {
  const resolved = Number(value);
  if (!Number.isInteger(resolved) || resolved <= 0) {
    throw new TaxDocumentContractError(code, message, { value });
  }
  return resolved;
};

const requireTaxPeriodId = (value) => {
  const taxPeriodId = String(value || '').trim();
  if (!taxPeriodId) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_ID',
      'Tax period detail requires taxPeriodId',
      { value },
    );
  }
  return taxPeriodId;
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
  const invalid = statuses.filter((status) => !TAX_PERIOD_STATUS_VALUES.includes(status));
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

  const getPeriodDetail = async (input = {}) => {
    const branchId = requirePositiveInteger(
      input.branchId,
      'INVALID_TAX_PERIOD_ADMINISTRATIVE_BRANCH',
      'Tax period administration requires a positive branchId',
    );
    const taxPeriodId = requireTaxPeriodId(input.taxPeriodId);
    const taxPeriod = await repository.findByIdAndBranch({ taxPeriodId, branchId });

    if (!taxPeriod) {
      throw new TaxDocumentContractError(
        'TAX_PERIOD_NOT_FOUND',
        'Tax period was not found for the requested branch',
        { taxPeriodId, branchId },
      );
    }

    return Object.freeze({
      branchId,
      taxPeriod: projectTaxPeriodAdministrativeResponse(taxPeriod),
    });
  };

  const getPeriodSummary = async (input = {}) => {
    const branchId = requirePositiveInteger(
      input.branchId,
      'INVALID_TAX_PERIOD_ADMINISTRATIVE_BRANCH',
      'Tax period administration requires a positive branchId',
    );
    const referenceDate =
      parseOptionalDate(
        input.referenceDate,
        'INVALID_TAX_PERIOD_ADMINISTRATIVE_REFERENCE_DATE',
      ) || new Date();
    const result = await repository.summarize({ branchId, referenceDate });
    const countsByStatus = TAX_PERIOD_STATUS_VALUES.reduce(
      (counts, status) => ({ ...counts, [status]: 0 }),
      {},
    );

    for (const group of result.statusGroups) {
      countsByStatus[group.status] = group.count;
    }

    return Object.freeze({
      branchId,
      referenceDate,
      total: Object.values(countsByStatus).reduce((sum, count) => sum + count, 0),
      countsByStatus: Object.freeze(countsByStatus),
      currentPeriod: result.currentPeriod
        ? projectTaxPeriodAdministrativeResponse(result.currentPeriod)
        : null,
    });
  };

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
    const projectedPeriods = projectTaxPeriodAdministrativeCollection(periods);

    return Object.freeze({
      branchId,
      count: projectedPeriods.length,
      periods: projectedPeriods,
    });
  };

  return Object.freeze({
    ensureMonthlyPeriod,
    ensureOperationalReadiness,
    getPeriodDetail,
    getPeriodSummary,
    listPeriods,
  });
};

module.exports = {
  TAX_PERIOD_STATUS_VALUES,
  createTaxPeriodAdministrativeService,
  normalizeStatuses,
  parseOptionalDate,
  requirePositiveInteger,
  requireTaxPeriodId,
};
