const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const DEFAULT_MONTHS_AHEAD = 1;
const MAX_MONTHS_AHEAD = 12;

const requireReferenceDate = (value) => {
  const date = value == null ? new Date() : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_READINESS_DATE',
      'Tax period operational readiness requires a valid reference date',
      { referenceDate: value },
    );
  }

  return date;
};

const normalizeBranchIds = (branchIds) => {
  if (!Array.isArray(branchIds) || branchIds.length === 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_READINESS_BRANCHES',
      'Tax period operational readiness requires explicit active branch ids',
    );
  }

  const normalized = [...new Set(branchIds)];
  const invalidBranchIds = normalized.filter(
    (branchId) => !Number.isInteger(branchId) || branchId <= 0,
  );

  if (invalidBranchIds.length > 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_READINESS_BRANCHES',
      'Tax period operational readiness branch ids must be positive integers',
      { invalidBranchIds },
    );
  }

  return Object.freeze(normalized.sort((left, right) => left - right));
};

const normalizeMonthsAhead = (value) => {
  const monthsAhead = value == null ? DEFAULT_MONTHS_AHEAD : value;

  if (
    !Number.isInteger(monthsAhead) ||
    monthsAhead < 0 ||
    monthsAhead > MAX_MONTHS_AHEAD
  ) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_READINESS_HORIZON',
      `Tax period readiness monthsAhead must be between 0 and ${MAX_MONTHS_AHEAD}`,
      { monthsAhead: value },
    );
  }

  return monthsAhead;
};

const monthStartUtc = (date, offset) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));

const buildReadinessTargets = ({ branchIds, referenceDate, monthsAhead }) => {
  const targets = [];

  for (const branchId of branchIds) {
    for (let offset = 0; offset <= monthsAhead; offset += 1) {
      targets.push(
        Object.freeze({
          branchId,
          periodDate: monthStartUtc(referenceDate, offset),
        }),
      );
    }
  }

  return Object.freeze(targets);
};

const normalizeTaxPeriodOperationalReadinessCommand = (input) => {
  if (!input || typeof input !== 'object') {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_READINESS_COMMAND',
      'Tax period operational readiness requires a command object',
    );
  }

  const branchIds = normalizeBranchIds(input.branchIds);
  const referenceDate = requireReferenceDate(input.referenceDate);
  const monthsAhead = normalizeMonthsAhead(input.monthsAhead);

  return Object.freeze({
    branchIds,
    referenceDate,
    monthsAhead,
    targets: buildReadinessTargets({ branchIds, referenceDate, monthsAhead }),
  });
};

module.exports = {
  DEFAULT_MONTHS_AHEAD,
  MAX_MONTHS_AHEAD,
  buildReadinessTargets,
  monthStartUtc,
  normalizeBranchIds,
  normalizeMonthsAhead,
  normalizeTaxPeriodOperationalReadinessCommand,
  requireReferenceDate,
};