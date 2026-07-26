const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const {
  normalizeTaxPeriodOperationalReadinessCommand,
} = require('../policies/taxPeriodOperationalReadinessPolicy');

const {
  createTaxPeriodAvailabilityService,
} = require('./taxPeriodAvailabilityService');

const createTaxPeriodOperationalReadinessService = ({ db }) => {
  const availabilityService = createTaxPeriodAvailabilityService({ db });

  const ensureOperationalReadiness = async (input) => {
    const command = normalizeTaxPeriodOperationalReadinessCommand(input);
    const results = [];

    for (const target of command.targets) {
      const availability = await availabilityService.ensureMonthlyPeriod(target);

      if (!availability?.available || !availability.taxPeriod?.id) {
        throw new TaxDocumentContractError(
          'TAX_PERIOD_READINESS_RESULT_MISSING',
          'Tax period readiness target completed without an available tax period',
          {
            branchId: target.branchId,
            periodDate: target.periodDate.toISOString(),
          },
        );
      }

      results.push(
        Object.freeze({
          branchId: target.branchId,
          periodDate: target.periodDate,
          created: availability.created,
          replayed: availability.replayed,
          taxPeriod: availability.taxPeriod,
        }),
      );
    }

    const createdCount = results.filter((result) => result.created).length;
    const replayedCount = results.filter((result) => result.replayed).length;

    return Object.freeze({
      ready: true,
      branchCount: command.branchIds.length,
      periodTargetCount: command.targets.length,
      createdCount,
      replayedCount,
      referenceDate: command.referenceDate,
      monthsAhead: command.monthsAhead,
      results: Object.freeze(results),
    });
  };

  return Object.freeze({ ensureOperationalReadiness });
};

module.exports = {
  createTaxPeriodOperationalReadinessService,
};