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
  TAX_LEDGER_TYPES,
  projectTaxDocumentDraftToLedgerEntry,
  resolveLedgerType,
} = require('./projections/taxLedgerEntryProjection');

const {
  createSaleTaxProjectionRuntime,
} = require('./application/saleTaxProjectionRuntimeService');

const {
  createTaxDocumentLedgerPublicationRuntime,
  publishDocumentAndLedgerInTransaction,
} = require('./application/taxDocumentLedgerPublicationRuntimeService');

const {
  createTaxLedgerPeriodAssignmentService,
} = require('./application/taxLedgerPeriodAssignmentService');

const {
  SALE_TAX_PROJECTION_ACTIONS,
  SALE_TAX_TREATMENTS,
  resolveSaleTaxProjectionDecision,
} = require('./policies/saleTaxProjectionGateway');

const {
  TAX_PERIOD_ASSIGNABLE_STATUSES,
  assertTaxPeriodCandidate,
  isAssignableTaxPeriodStatus,
  periodContainsDate,
  resolveTaxPeriodDate,
} = require('./policies/taxPeriodResolutionPolicy');

const {
  createPrismaTaxDocumentPublisher,
} = require('./infrastructure/prismaTaxDocumentPublisher');

const {
  createPrismaTaxLedgerPublisher,
} = require('./infrastructure/prismaTaxLedgerPublisher');

const {
  createPrismaTaxPeriodResolver,
} = require('./infrastructure/prismaTaxPeriodResolver');

const {
  createPrismaTaxLedgerPeriodAssignmentRepository,
} = require('./infrastructure/prismaTaxLedgerPeriodAssignmentRepository');

module.exports = {
  TAX_DOCUMENT_DIRECTIONS,
  TAX_DOCUMENT_SOURCE_TYPES,
  TAX_DOCUMENT_TYPES,
  TAX_LEDGER_TYPES,
  TAX_PERIOD_ASSIGNABLE_STATUSES,
  SALE_TAX_PROJECTION_ACTIONS,
  SALE_TAX_TREATMENTS,
  TaxDocumentContractError,
  assertTaxPeriodCandidate,
  buildTaxDocumentDraft,
  createPrismaTaxDocumentPublisher,
  createPrismaTaxLedgerPeriodAssignmentRepository,
  createPrismaTaxLedgerPublisher,
  createPrismaTaxPeriodResolver,
  createSaleTaxProjectionRuntime,
  createTaxDocumentLedgerPublicationRuntime,
  createTaxLedgerPeriodAssignmentService,
  isAssignableTaxPeriodStatus,
  isTaxDocumentDirection,
  isTaxDocumentSourceType,
  isTaxDocumentType,
  normalizeTaxDocumentCommand,
  periodContainsDate,
  projectCompletedSaleToTaxDocument,
  projectTaxDocumentDraftToLedgerEntry,
  publishDocumentAndLedgerInTransaction,
  resolveLedgerType,
  resolveSaleTaxProjectionDecision,
  resolveTaxDocumentType,
  resolveTaxPeriodDate,
  stableHash,
};
