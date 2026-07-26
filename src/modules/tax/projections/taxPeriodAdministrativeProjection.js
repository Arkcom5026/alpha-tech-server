const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');
const {
  projectTaxPeriodAvailableActions,
} = require('../policies/taxPeriodLifecyclePolicy');

const TAX_PERIOD_ADMINISTRATIVE_RESPONSE_VERSION = '1';

const requireTaxPeriodProjectionSource = (taxPeriod) => {
  if (!taxPeriod || typeof taxPeriod !== 'object') {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERIOD_ADMINISTRATIVE_PROJECTION_SOURCE',
      'Tax period administrative projection requires a Tax Period source',
    );
  }
  return taxPeriod;
};

const projectTaxPeriodAdministrativeResponse = (source) => {
  const taxPeriod = requireTaxPeriodProjectionSource(source);

  return Object.freeze({
    responseVersion: TAX_PERIOD_ADMINISTRATIVE_RESPONSE_VERSION,
    id: taxPeriod.id,
    branchId: taxPeriod.branchId,
    periodCode: taxPeriod.periodCode,
    startDate: taxPeriod.startDate,
    endDate: taxPeriod.endDate,
    status: taxPeriod.status,
    closedAt: taxPeriod.closedAt ?? null,
    lockedAt: taxPeriod.lockedAt ?? null,
    submittedAt: taxPeriod.submittedAt ?? null,
    reopenedAt: taxPeriod.reopenedAt ?? null,
    createdAt: taxPeriod.createdAt,
    updatedAt: taxPeriod.updatedAt,
    availableActions: projectTaxPeriodAvailableActions(taxPeriod.status),
  });
};

const projectTaxPeriodAdministrativeCollection = (taxPeriods = []) =>
  Object.freeze(taxPeriods.map(projectTaxPeriodAdministrativeResponse));

module.exports = {
  TAX_PERIOD_ADMINISTRATIVE_RESPONSE_VERSION,
  projectTaxPeriodAdministrativeCollection,
  projectTaxPeriodAdministrativeResponse,
  requireTaxPeriodProjectionSource,
};
