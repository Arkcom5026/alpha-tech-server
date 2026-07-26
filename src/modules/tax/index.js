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
  applyTaxPeriodResolution,
  createTaxDocumentLedgerPublicationRuntime,
  publishDocumentAndLedgerInTransaction,
} = require('./application/taxDocumentLedgerPublicationRuntimeService');

const {
  createTaxLedgerPeriodAssignmentService,
} = require('./application/taxLedgerPeriodAssignmentService');

const {
  createTaxPeriodAvailabilityService,
} = require('./application/taxPeriodAvailabilityService');

const {
  createTaxPeriodCreationService,
} = require('./application/taxPeriodCreationService');

const {
  createTaxPeriodLifecycleService,
} = require('./application/taxPeriodLifecycleService');

const {
  createTaxPeriodOperationalReadinessService,
} = require('./application/taxPeriodOperationalReadinessService');

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
  assertTaxPeriodAvailable,
  normalizeEnsureTaxPeriodCommand,
  requireAvailabilityDate,
} = require('./policies/taxPeriodAvailabilityPolicy');

const {
  DEFAULT_MONTHS_AHEAD,
  MAX_MONTHS_AHEAD,
  buildReadinessTargets,
  monthStartUtc,
  normalizeBranchIds,
  normalizeMonthsAhead,
  normalizeTaxPeriodOperationalReadinessCommand,
  requireReferenceDate,
} = require('./policies/taxPeriodOperationalReadinessPolicy');

const {
  BRANCH_TAX_ADMIN_ROLES,
  GLOBAL_TAX_ADMIN_ROLES,
  assertBranchScope,
  assertReadinessBranchScope,
  resolveTaxAdministratorScope,
} = require('./policies/taxPeriodAdministrativeBranchScopePolicy');

const {
  TAX_PERIOD_ACTION_BY_TARGET_STATUS,
  TAX_PERIOD_STATUSES,
  TAX_PERIOD_TRANSITIONS,
  assertTaxPeriodTransition,
  buildTaxPeriodLifecycleUpdate,
  normalizeTaxPeriodLifecycleCommand,
  projectTaxPeriodAvailableActions,
} = require('./policies/taxPeriodLifecyclePolicy');

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

const {
  createPrismaTaxPeriodLifecycleRepository,
} = require('./infrastructure/prismaTaxPeriodLifecycleRepository');

module.exports = {
  BRANCH_TAX_ADMIN_ROLES,
  DEFAULT_MONTHS_AHEAD,
  GLOBAL_TAX_ADMIN_ROLES,
  MAX_MONTHS_AHEAD,
  TAX_DOCUMENT_DIRECTIONS,
  TAX_DOCUMENT_SOURCE_TYPES,
  TAX_DOCUMENT_TYPES,
  TAX_LEDGER_TYPES,
  TAX_PERIOD_ACTION_BY_TARGET_STATUS,
  TAX_PERIOD_ASSIGNABLE_STATUSES,
  TAX_PERIOD_INITIAL_STATUS,
  TAX_PERIOD_STATUSES,
  TAX_PERIOD_TRANSITIONS,
  SALE_TAX_PROJECTION_ACTIONS,
  SALE_TAX_TREATMENTS,
  TaxDocumentContractError,
  applyTaxPeriodResolution,
  assertBranchScope,
  assertReadinessBranchScope,
  assertTaxPeriodAvailable,
  assertTaxPeriodCandidate,
  assertTaxPeriodReplay,
  assertTaxPeriodTransition,
  buildMonthlyTaxPeriodBoundary,
  buildReadinessTargets,
  buildTaxDocumentDraft,
  buildTaxPeriodLifecycleUpdate,
  createPrismaTaxDocumentPublisher,
  createPrismaTaxLedgerPeriodAssignmentRepository,
  createPrismaTaxLedgerPublisher,
  createPrismaTaxPeriodCreationRepository,
  createPrismaTaxPeriodLifecycleRepository,
  createPrismaTaxPeriodResolver,
  createSaleTaxProjectionRuntime,
  createTaxDocumentLedgerPublicationRuntime,
  createTaxLedgerPeriodAssignmentService,
  createTaxPeriodAvailabilityService,
  createTaxPeriodCreationService,
  createTaxPeriodLifecycleService,
  createTaxPeriodOperationalReadinessService,
  isAssignableTaxPeriodStatus,
  isTaxDocumentDirection,
  isTaxDocumentSourceType,
  isTaxDocumentType,
  monthStartUtc,
  normalizeBranchIds,
  normalizeCreateMonthlyTaxPeriodCommand,
  normalizeEnsureTaxPeriodCommand,
  normalizeMonthsAhead,
  normalizeTaxDocumentCommand,
  normalizeTaxPeriodLifecycleCommand,
  normalizeTaxPeriodOperationalReadinessCommand,
  periodContainsDate,
  projectCompletedSaleToTaxDocument,
  projectTaxDocumentDraftToLedgerEntry,
  projectTaxPeriodAvailableActions,
  publishDocumentAndLedgerInTransaction,
  requireAvailabilityDate,
  requireReferenceDate,
  resolveLedgerType,
  resolveSaleTaxProjectionDecision,
  resolveTaxAdministratorScope,
  resolveTaxDocumentType,
  resolveTaxPeriodDate,
  sameBoundary,
  stableHash,
};