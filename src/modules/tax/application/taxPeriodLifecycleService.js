const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const {
  assertTaxPeriodTransition,
  buildTaxPeriodLifecycleUpdate,
  normalizeTaxPeriodLifecycleCommand,
} = require('../policies/taxPeriodLifecyclePolicy');
const {
  projectTaxPeriodAdministrativeResponse,
} = require('../projections/taxPeriodAdministrativeProjection');

const {
  createPrismaTaxPeriodLifecycleRepository,
} = require('../infrastructure/prismaTaxPeriodLifecycleRepository');

const createTaxPeriodLifecycleService = ({ db }) => {
  const repository = createPrismaTaxPeriodLifecycleRepository({ db });

  const transitionPeriod = async (command) => {
    const normalized = normalizeTaxPeriodLifecycleCommand(command);
    const current = await repository.findByIdAndBranch(normalized);

    if (!current) {
      throw new TaxDocumentContractError(
        'TAX_PERIOD_NOT_FOUND',
        'Tax period was not found for the requested branch',
        {
          taxPeriodId: normalized.taxPeriodId,
          branchId: normalized.branchId,
        },
      );
    }

    const decision = assertTaxPeriodTransition({
      currentStatus: current.status,
      targetStatus: normalized.targetStatus,
    });

    if (decision.replayed) {
      return Object.freeze({
        transitioned: false,
        replayed: true,
        previousStatus: current.status,
        taxPeriod: projectTaxPeriodAdministrativeResponse(current),
      });
    }

    const data = buildTaxPeriodLifecycleUpdate(normalized);
    const taxPeriod = await repository.transition({
      ...normalized,
      currentStatus: current.status,
      data,
    });

    return Object.freeze({
      transitioned: true,
      replayed: false,
      previousStatus: current.status,
      taxPeriod: projectTaxPeriodAdministrativeResponse(taxPeriod),
    });
  };

  return Object.freeze({ transitionPeriod });
};

module.exports = {
  createTaxPeriodLifecycleService,
};
