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
  TAX_AUTHORITY_SUBMISSION_ACTIONS,
  TaxAuthoritySubmissionContractError,
  normalizeTaxAuthoritySubmissionCommand,
} = require('./contracts/taxAuthoritySubmissionCommand');

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
  TaxAuthoritySubmissionRuntimeError,
  cancelSubmission,
  enqueueSubmission,
  retrySubmission,
} = require('./application/taxAuthoritySubmissionRuntime');

const {
  TAX_DOCUMENT_LIFECYCLE_EVENT_TYPES,
  TAX_DOCUMENT_STATUSES,
  TaxDocumentLifecycleTransitionError,
  assertCanCancel,
  assertCanCreateAdjustment,
  assertCanIssue,
} = require('./policies/taxDocumentLifecyclePolicy');

const {
  TAX_AUTHORITY_SUBMISSION_EVENT_TYPES,
  TAX_AUTHORITY_SUBMISSION_STATUSES,
  TaxAuthoritySubmissionTransitionError,
  assertCanCancelSubmission,
  assertCanEnqueue,
  assertCanRetry,
} = require('./policies/taxAuthoritySubmissionPolicy');

const {
  createPrismaTaxDocumentPublisher,
} = require('./infrastructure/prismaTaxDocumentPublisher');

const {
  TaxDocumentLifecyclePersistenceError,
  createPrismaTaxDocumentLifecyclePersistence,
} = require('./infrastructure/prismaTaxDocumentLifecyclePersistence');

module.exports = {
  TAX_AUTHORITY_SUBMISSION_ACTIONS,
  TAX_AUTHORITY_SUBMISSION_EVENT_TYPES,
  TAX_AUTHORITY_SUBMISSION_STATUSES,
  TAX_DOCUMENT_DIRECTIONS,
  TAX_DOCUMENT_LIFECYCLE_ACTIONS,
  TAX_DOCUMENT_LIFECYCLE_EVENT_TYPES,
  TAX_DOCUMENT_SOURCE_TYPES,
  TAX_DOCUMENT_STATUSES,
  TAX_DOCUMENT_TYPES,
  TaxAuthoritySubmissionContractError,
  TaxAuthoritySubmissionRuntimeError,
  TaxAuthoritySubmissionTransitionError,
  TaxDocumentContractError,
  TaxDocumentLifecycleContractError,
  TaxDocumentLifecyclePersistenceError,
  TaxDocumentLifecycleRuntimeError,
  TaxDocumentLifecycleTransitionError,
  assertCanCancel,
  assertCanCancelSubmission,
  assertCanCreateAdjustment,
  assertCanEnqueue,
  assertCanIssue,
  assertCanRetry,
  buildTaxDocumentDraft,
  cancelDocument,
  cancelSubmission,
  createCreditNote,
  createDebitNote,
  createPrismaTaxDocumentLifecyclePersistence,
  createPrismaTaxDocumentPublisher,
  createSaleTaxProjectionRuntime,
  enqueueSubmission,
  isTaxDocumentDirection,
  isTaxDocumentSourceType,
  isTaxDocumentType,
  issueDocument,
  normalizeTaxAuthoritySubmissionCommand,
  normalizeTaxDocumentCommand,
  normalizeTaxDocumentLifecycleCommand,
  projectCompletedSaleToTaxDocument,
  resolveTaxDocumentType,
  retrySubmission,
  stableHash,
};
