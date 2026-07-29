'use strict';

const REPLACEMENT_STATUSES = Object.freeze([
  'NONE',
  'REPLACED_SOURCE',
  'ACTIVE_REPLACEMENT',
  'CHAIN_CONFLICT',
]);

const createReplacementProjection = ({
  status = 'NONE',
  replacesTaxDocumentId = null,
  replacedByTaxDocumentId = null,
  chainRootTaxDocumentId = null,
}) => Object.freeze({
  status,
  replacesTaxDocumentId,
  replacedByTaxDocumentId,
  chainRootTaxDocumentId,
  blocksEligibility: ['REPLACED_SOURCE', 'CHAIN_CONFLICT'].includes(status),
});

module.exports = Object.freeze({
  REPLACEMENT_STATUSES,
  createReplacementProjection,
});
