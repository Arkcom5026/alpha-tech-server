const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const {
  projectCompletedSaleToTaxDocument,
} = require('../projections/saleTaxDocumentProjection');

const {
  SALE_TAX_PROJECTION_ACTIONS,
  resolveSaleTaxProjectionDecision,
} = require('../policies/saleTaxProjectionGateway');

const requirePublisher = (publisher) => {
  if (!publisher || typeof publisher.publish !== 'function') {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PROJECTION_PUBLISHER',
      'Tax projection publisher must expose publish(draft)',
    );
  }

  return publisher;
};

const createSaleTaxProjectionRuntime = ({ publisher }) => {
  const resolvedPublisher = requirePublisher(publisher);

  const projectAndPublishCompletedSale = async ({
    sale,
    commandKey,
    correlationId = null,
    occurredAt = null,
  }) => {
    const decision = resolveSaleTaxProjectionDecision({ sale });

    if (decision.action === SALE_TAX_PROJECTION_ACTIONS.SKIP) {
      return Object.freeze({
        decision,
        draft: null,
        publication: null,
      });
    }

    const draft = projectCompletedSaleToTaxDocument({
      sale,
      commandKey,
      correlationId,
      occurredAt,
    });

    const publication = await resolvedPublisher.publish(draft);

    return Object.freeze({
      decision,
      draft,
      publication: publication ?? null,
    });
  };

  return Object.freeze({
    projectAndPublishCompletedSale,
  });
};

module.exports = {
  createSaleTaxProjectionRuntime,
};
