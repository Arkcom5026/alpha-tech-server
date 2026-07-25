const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const {
  projectCompletedSaleToTaxDocument,
} = require('../projections/saleTaxDocumentProjection');

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
    const draft = projectCompletedSaleToTaxDocument({
      sale,
      commandKey,
      correlationId,
      occurredAt,
    });

    const publication = await resolvedPublisher.publish(draft);

    return Object.freeze({
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
