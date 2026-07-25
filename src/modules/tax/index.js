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
  TAX_DOCUMENT_LIFECYCLE_ACTIONS,
  TaxDocumentLifecycleContractError,
  normalizeTaxDocumentLifecycleCommand,
} = require('./contracts/taxDocumentLifecycleCommand');

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

const {
  TaxDocumentLifecycleRuntimeError,
  cancelDocument,
  createCreditNote,
  createDebitNote,
  issueDocument,
} = require('./application/taxDocumentLifecycleRuntime');

const {
  TAX_DOCUMENT_LIFECYCLE_EVENT_TYPES,
  TAX_DOCUMENT_STATUSES,
  TaxDocumentLifecycleTransitionError,
  assertCanCancel,
  assertCanCreateAdjustment,
  assertCanIssue,
} = require('./policies/taxDocumentLifecyclePolicy');

const {
  createPrismaTaxDocumentPublisher,
} = require('./infrastructure/prismaTaxDocumentPublisher');

const {
  TaxDocumentLifecyclePersistenceError,
  createPrismaTaxDocumentLifecyclePersistence,
} = require('./infrastructure/prismaTaxDocumentLifecyclePersistence');

module.exports = {
  TAX_DOCUMENT_DIRECTIONS,
  TAX_DOCUMENT_LIFECYCLE_ACTIONS,
  TAX_DOCUMENT_LIFECYCLE_EVENT_TYPES,
  TAX_DOCUMENT_SOURCE_TYPES,
  TAX_DOCUMENT_STATUSES,
  TAX_DOCUMENT_TYPES,
  TaxDocumentContractError,
  TaxDocumentLifecycleContractError,
  TaxDocumentLifecyclePersistenceError,
  TaxDocumentLifecycleRuntimeError,
  TaxDocumentLifecycleTransitionError,
  assertCanCancel,
  assertCanCreateAdjustment,
  assertCanIssue,
  buildTaxDocumentDraft,
  cancelDocument,
  createCreditNote,
  createDebitNote,
  createPrismaTaxDocumentLifecyclePersistence,
  createPrismaTaxDocumentPublisher,
  createSaleTaxProjectionRuntime,
  isTaxDocumentDirection,
  isTaxDocumentSourceType,
  isTaxDocumentType,
  issueDocument,
  normalizeTaxDocumentCommand,
  normalizeTaxDocumentLifecycleCommand,
  projectCompletedSaleToTaxDocument,
  resolveTaxDocumentType,
  stableHash,
};
