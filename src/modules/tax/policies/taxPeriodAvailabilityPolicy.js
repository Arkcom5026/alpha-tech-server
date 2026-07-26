const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const {
  TAX_PERIOD_ASSIGNABLE_STATUSES,
  isAssignableTaxPeriodStatus,
} = require('./taxPeriodResolutionPolicy');

const requireAvailabilityDate = (value) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_AVAILABILITY_DATE',
      'Tax period availability requires a valid date',
      { date: value },
    );
  }

  return date;
};

const normalizeEnsureTaxPeriodCommand = (input) => {
  if (!input || typeof input !== 'object') {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_AVAILABILITY_COMMAND',
      'Tax period availability requires a command object',
    );
  }

  if (!Number.isInteger(input.branchId) || input.branchId <= 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_BRANCH',
      'Tax period availability requires a positive branchId',
      { branchId: input.branchId },
    );
  }

  const periodDate = requireAvailabilityDate(input.periodDate);

  return Object.freeze({
    branchId: input.branchId,
    periodDate,
    year: periodDate.getUTCFullYear(),
    month: periodDate.getUTCMonth() + 1,
  });
};

const assertTaxPeriodAvailable = ({ taxPeriod, command }) => {
  if (!taxPeriod) {
    throw new TaxDocumentContractError(
      'TAX_PERIOD_AVAILABILITY_RESULT_MISSING',
      'Tax period availability completed without a Tax Period',
      {
        branchId: command.branchId,
        periodDate: command.periodDate.toISOString(),
      },
    );
  }

  if (taxPeriod.branchId !== command.branchId) {
    throw new TaxDocumentContractError(
      'TAX_PERIOD_BRANCH_MISMATCH',
      'Available Tax Period must belong to the requested branch',
      {
        requestedBranchId: command.branchId,
        taxPeriodId: taxPeriod.id,
        taxPeriodBranchId: taxPeriod.branchId,
      },
    );
  }

  if (!isAssignableTaxPeriodStatus(taxPeriod.status)) {
    throw new TaxDocumentContractError(
      'TAX_PERIOD_NOT_AVAILABLE',
      'Tax Period exists but is not available for ledger assignment',
      {
        taxPeriodId: taxPeriod.id,
        status: taxPeriod.status,
        assignableStatuses: [...TAX_PERIOD_ASSIGNABLE_STATUSES],
      },
    );
  }

  return taxPeriod;
};

module.exports = {
  assertTaxPeriodAvailable,
  normalizeEnsureTaxPeriodCommand,
  requireAvailabilityDate,
};
