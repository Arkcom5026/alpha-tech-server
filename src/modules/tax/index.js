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
  createTaxPeriodCreationService,
} = require('./application/taxPeriodCreationService');

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
  TAX_PERIOD_INITIAL_STATUS,
  assertTaxPeriodReplay,
  buildMonthlyTaxPeriodBoundary,
  normalizeCreateMonthlyTaxPeriodCommand,
  sameBoundary,
} = require('./policies/taxPeriodCreationPolicy');

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

const {
  createPrismaTaxPeriodCreationRepository,
} = require('./infrastructure/prismaTaxPeriodCreationRepository');

module.exports = {
  TAX_DOCUMENT_DIRECTIONS,
  TAX_DOCUMENT_SOURCE_TYPES,
  TAX_DOCUMENT_TYPES,
  TAX_LEDGER_TYPES,
  TAX_PERIOD_ASSIGNABLE_STATUSES,
  TAX_PERIOD_INITIAL_STATUS,
  SALE_TAX_PROJECTION_ACTIONS,
  SALE_TAX_TREATMENTS,
  TaxDocumentContractError,
  assertTaxPeriodCandidate,
  assertTaxPeriodReplay,
  buildMonthlyTaxPeriodBoundary,
  buildTaxDocumentDraft,
  createPrismaTaxDocumentPublisher,
  createPrismaTaxLedgerPeriodAssignmentRepository,
  createPrismaTaxLedgerPublisher,
  createPrismaTaxPeriodCreationRepository,
  createPrismaTaxPeriodResolver,
  createSaleTaxProjectionRuntime,
  createTaxDocumentLedgerPublicationRuntime,
  createTaxLedgerPeriodAssignmentService,
  createTaxPeriodCreationService,
  isAssignableTaxPeriodStatus,
  isTaxDocumentDirection,
  isTaxDocumentSourceType,
  isTaxDocumentType,
  normalizeCreateMonthlyTaxPeriodCommand,
  normalizeTaxDocumentCommand,
  periodContainsDate,
  projectCompletedSaleToTaxDocument,
  projectTaxDocumentDraftToLedgerEntry,
  publishDocumentAndLedgerInTransaction,
  resolveLedgerType,
  resolveSaleTaxProjectionDecision,
  resolveTaxDocumentType,
  resolveTaxPeriodDate,
  sameBoundary,
  stableHash,
};