const {
  TAX_DOCUMENT_DIRECTIONS,
  TAX_DOCUMENT_SOURCE_TYPES,
  TAX_DOCUMENT_TYPES,
  isTaxDocumentDirection,
  isTaxDocumentSourceType,
  isTaxDocumentType,
} = require('./contracts/taxDocumentSourceTypes');

const {
  TaxDocumentContractError,
  normalizeTaxDocumentCommand,
} = require('./contracts/createTaxDocumentCommand');

const {
  buildTaxDocumentDraft,
  stableHash,
} = require('./factories/taxDocumentFactory');

const {
  projectCompletedSaleToTaxDocument,
  resolveTaxDocumentType,
} = require('./projections/saleTaxDocumentProjection');

const {
  createSaleTaxProjectionRuntime,
} = require('./application/saleTaxProjectionRuntimeService');

module.exports = {
  TAX_DOCUMENT_DIRECTIONS,
  TAX_DOCUMENT_SOURCE_TYPES,
  TAX_DOCUMENT_TYPES,
  TaxDocumentContractError,
  buildTaxDocumentDraft,
  createSaleTaxProjectionRuntime,
  isTaxDocumentDirection,
  isTaxDocumentSourceType,
  isTaxDocumentType,
  normalizeTaxDocumentCommand,
  projectCompletedSaleToTaxDocument,
  resolveTaxDocumentType,
  stableHash,
};
