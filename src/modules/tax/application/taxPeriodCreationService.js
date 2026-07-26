const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const {
  assertTaxPeriodReplay,
  normalizeCreateMonthlyTaxPeriodCommand,
} = require('../policies/taxPeriodCreationPolicy');

const {
  createPrismaTaxPeriodCreationRepository,
} = require('../infrastructure/prismaTaxPeriodCreationRepository');

const assertNoOverlappingPeriod = ({ overlaps, command }) => {
  if (overlaps.length === 0) return;

  throw new TaxDocumentContractError(
    'TAX_PERIOD_BOUNDARY_OVERLAP',
    'Requested tax period overlaps an existing tax period in the same branch',
    {
      branchId: command.branchId,
      periodCode: command.periodCode,
      overlappingTaxPeriodIds: overlaps.map((period) => period.id),
    },
  );
};

const createTaxPeriodCreationService = ({ db }) => {
  const repository = createPrismaTaxPeriodCreationRepository({ db });

  const createMonthlyPeriod = async (input) => {
    const command = normalizeCreateMonthlyTaxPeriodCommand(input);

    const existing = await repository.findByPeriodCode(command);
    if (existing) {
      assertTaxPeriodReplay({ period: existing, command });

      return Object.freeze({
        created: false,
        replayed: true,
        taxPeriod: Object.freeze({ ...existing }),
      });
    }

    const overlaps = await repository.findOverlapping(command);
    assertNoOverlappingPeriod({ overlaps, command });

    try {
      const taxPeriod = await repository.create(command);

      return Object.freeze({
        created: true,
        replayed: false,
        taxPeriod: Object.freeze({ ...taxPeriod }),
      });
    } catch (error) {
      if (error?.code !== 'P2002') throw error;

      const replay = await repository.findByPeriodCode(command);
      if (!replay) {
        throw new TaxDocumentContractError(
          'TAX_PERIOD_CREATION_CONFLICT',
          'Tax period creation conflicted with another write',
          {
            branchId: command.branchId,
            periodCode: command.periodCode,
          },
        );
      }

      assertTaxPeriodReplay({ period: replay, command });

      return Object.freeze({
        created: false,
        replayed: true,
        taxPeriod: Object.freeze({ ...replay }),
      });
    }
  };

  return Object.freeze({ createMonthlyPeriod });
};

module.exports = {
  assertNoOverlappingPeriod,
  createTaxPeriodCreationService,
};