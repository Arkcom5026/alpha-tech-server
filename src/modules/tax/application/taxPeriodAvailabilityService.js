const {
  createTaxPeriodCreationService,
} = require('./taxPeriodCreationService');

const {
  assertTaxPeriodAvailable,
  normalizeEnsureTaxPeriodCommand,
} = require('../policies/taxPeriodAvailabilityPolicy');

const createTaxPeriodAvailabilityService = ({ db }) => {
  const creationService = createTaxPeriodCreationService({ db });

  const ensureMonthlyPeriod = async (input) => {
    const command = normalizeEnsureTaxPeriodCommand(input);
    const creation = await creationService.createMonthlyPeriod({
      branchId: command.branchId,
      year: command.year,
      month: command.month,
    });

    const taxPeriod = assertTaxPeriodAvailable({
      taxPeriod: creation.taxPeriod,
      command,
    });

    return Object.freeze({
      available: true,
      created: creation.created,
      replayed: creation.replayed,
      periodDate: command.periodDate,
      taxPeriod: Object.freeze({ ...taxPeriod }),
    });
  };

  return Object.freeze({ ensureMonthlyPeriod });
};

module.exports = {
  createTaxPeriodAvailabilityService,
};
