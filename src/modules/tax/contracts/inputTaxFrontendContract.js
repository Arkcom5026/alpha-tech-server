'use strict';

const CONTRACT_VERSION = 1;
const TAX_INTAKE_BASE = '/api/tax-intake';
const TAX_PERIOD_BASE = '/api/tax-periods';
const INPUT_TAX_REPORT_BASE = '/api/input-tax-reports';

const InputTaxFrontendErrorCode = Object.freeze({
  DECISION_ACCESS_FORBIDDEN: 'INPUT_TAX_DECISION_ACCESS_FORBIDDEN',
  DECISION_ACTOR_REQUIRED: 'INPUT_TAX_DECISION_ACTOR_REQUIRED',
  DECISION_BRANCH_FORBIDDEN: 'INPUT_TAX_DECISION_BRANCH_FORBIDDEN',
  DECISION_REASON_REQUIRED: 'INPUT_TAX_DECISION_REASON_REQUIRED',
  DOCUMENT_ALREADY_IN_FILING: 'INPUT_TAX_DOCUMENT_ALREADY_IN_FILING',
  FILING_ACCESS_FORBIDDEN: 'INPUT_TAX_FILING_ACCESS_FORBIDDEN',
  FILING_ACTOR_REQUIRED: 'INPUT_TAX_FILING_ACTOR_REQUIRED',
  FILING_BATCH_BRANCH_MISMATCH: 'INPUT_TAX_FILING_BATCH_BRANCH_MISMATCH',
  FILING_BATCH_NOT_MUTABLE: 'INPUT_TAX_FILING_BATCH_NOT_MUTABLE',
  FILING_BRANCH_FORBIDDEN: 'INPUT_TAX_FILING_BRANCH_FORBIDDEN',
  FILING_ELIGIBILITY_REQUIRED: 'INPUT_TAX_FILING_ELIGIBILITY_REQUIRED',
  FILING_RECONCILIATION_REQUIRED: 'INPUT_TAX_FILING_RECONCILIATION_REQUIRED',
  FILING_STALE: 'INPUT_TAX_FILING_STALE',
  LINK_ACCESS_FORBIDDEN: 'INPUT_TAX_LINK_ACCESS_FORBIDDEN',
  LINK_BRANCH_FORBIDDEN: 'INPUT_TAX_LINK_BRANCH_FORBIDDEN',
  OVERVIEW_ACCESS_FORBIDDEN: 'INPUT_TAX_OVERVIEW_ACCESS_FORBIDDEN',
  OVERVIEW_BRANCH_FORBIDDEN: 'INPUT_TAX_OVERVIEW_BRANCH_FORBIDDEN',
  OVERVIEW_RANGE_TOO_LARGE: 'INPUT_TAX_OVERVIEW_RANGE_TOO_LARGE',
  PERIOD_MUTATION_BLOCKED: 'INPUT_TAX_PERIOD_MUTATION_BLOCKED',
  REASON_REQUIRED: 'INPUT_TAX_REASON_REQUIRED',
  REPLACEMENT_ALREADY_LINKED: 'INPUT_TAX_REPLACEMENT_ALREADY_LINKED',
  REPLACEMENT_CYCLE: 'INPUT_TAX_REPLACEMENT_CYCLE',
  REPLACEMENT_SELF_REFERENCE: 'INPUT_TAX_REPLACEMENT_SELF_REFERENCE',
  REPORT_RANGE_TOO_LARGE: 'INPUT_TAX_REPORT_RANGE_TOO_LARGE',
  REPORT_RESULT_TOO_LARGE: 'INPUT_TAX_REPORT_RESULT_TOO_LARGE',
  STALE_VERSION: 'INPUT_TAX_STALE_VERSION',
  TAX_DOCUMENT_LIFECYCLE_CONFLICT: 'TAX_DOCUMENT_LIFECYCLE_CONFLICT',
  TAX_DOCUMENT_NOT_FOUND: 'TAX_DOCUMENT_NOT_FOUND',
  TAX_PERIOD_INPUT_FILING_INCOMPLETE: 'TAX_PERIOD_INPUT_FILING_INCOMPLETE',
  TAX_PERIOD_INPUT_FILING_NOT_SUBMITTED: 'TAX_PERIOD_INPUT_FILING_NOT_SUBMITTED',
  TAX_PERIOD_STALE_VERSION: 'TAX_PERIOD_STALE_VERSION',
});

const commonAuthority = Object.freeze({
  authentication: 'Bearer JWT via verifyToken',
  branchAuthority: 'Authenticated employee branch; ADMIN/SUPERADMIN may administer explicit branchId',
  privilegedRoles: Object.freeze(['SUPERADMIN', 'ADMIN', 'OWNER', 'MANAGER']),
  ordinaryRole: 'CASHIER',
  frontendAuthority: false,
});

const endpoint = (value) => Object.freeze({ ...value, authority: commonAuthority });

const endpoints = Object.freeze([
  endpoint({ id: 'input-tax-overview', method: 'GET', path: `${TAX_INTAKE_BASE}/input-documents/overview`, request: Object.freeze({ query: ['branchId', 'periodView', 'periodFrom', 'periodTo'] }), response: 'InputTaxOverview projection with headline, reconciliation, quality, filingReadiness and recentDocuments', capability: 'VIEW', replay: 'READ_RETRY_SAFE', bounds: Object.freeze({ maxExplicitRangeDays: 366 }), errors: Object.freeze(['INPUT_TAX_OVERVIEW_ACCESS_FORBIDDEN', 'INPUT_TAX_OVERVIEW_BRANCH_FORBIDDEN', 'INPUT_TAX_OVERVIEW_RANGE_TOO_LARGE']) }),
  endpoint({ id: 'input-tax-pending', method: 'GET', path: `${TAX_INTAKE_BASE}/input-documents/pending`, request: Object.freeze({ query: ['branchId'] }), response: 'Pending input-tax document projection', capability: 'VIEW', replay: 'READ_RETRY_SAFE', errors: Object.freeze([]) }),
  endpoint({ id: 'tax-document-list', method: 'GET', path: `${TAX_INTAKE_BASE}/documents`, request: Object.freeze({ query: ['branchId', 'status', 'documentType', 'limit', 'offset'] }), response: 'Bounded TaxDocument list', capability: 'VIEW', replay: 'READ_RETRY_SAFE', bounds: Object.freeze({ defaultLimit: 50, maxLimit: 200, offset: true }), errors: Object.freeze([]) }),
  endpoint({ id: 'tax-document-detail', method: 'GET', path: `${TAX_INTAKE_BASE}/documents/:taxDocumentId`, request: Object.freeze({ query: ['branchId'], params: ['taxDocumentId'] }), response: 'TaxDocument detail plus ordered lifecycleEvents', capability: 'VIEW', replay: 'READ_RETRY_SAFE', errors: Object.freeze(['TAX_DOCUMENT_NOT_FOUND']) }),
  endpoint({ id: 'tax-document-transition', method: 'POST', path: `${TAX_INTAKE_BASE}/documents/:taxDocumentId/transition`, request: Object.freeze({ body: ['branchId', 'targetStatus', 'reason'], params: ['taxDocumentId'] }), response: 'Lifecycle transition result; APPROVED input tax may include InputVatRecord projection', capability: 'REVIEW', replay: 'MUTATION_REPLAY_SAFE', errors: Object.freeze(['TAX_DOCUMENT_LIFECYCLE_CONFLICT']) }),
  endpoint({ id: 'receipt-link-list', method: 'GET', path: `${TAX_INTAKE_BASE}/documents/:taxDocumentId/receipt-links`, request: Object.freeze({ query: ['branchId'], params: ['taxDocumentId'] }), response: 'Receipt link list', capability: 'VIEW', replay: 'READ_RETRY_SAFE', errors: Object.freeze(['INPUT_TAX_LINK_ACCESS_FORBIDDEN', 'INPUT_TAX_LINK_BRANCH_FORBIDDEN']) }),
  endpoint({ id: 'receipt-link-attach', method: 'POST', path: `${TAX_INTAKE_BASE}/documents/:taxDocumentId/receipt-links`, request: Object.freeze({ body: ['branchId', 'commandKey', 'receiptReferences'], params: ['taxDocumentId'] }), response: 'Attached/replayed receipt-link command result', capability: 'REVIEW', replay: 'MUTATION_REPLAY_SAFE_WITH_COMMAND_KEY', errors: Object.freeze(['INPUT_TAX_LINK_ACCESS_FORBIDDEN', 'INPUT_TAX_LINK_BRANCH_FORBIDDEN']) }),
  endpoint({ id: 'receipt-link-reallocate', method: 'PATCH', path: `${TAX_INTAKE_BASE}/documents/:taxDocumentId/receipt-links/:linkId`, request: Object.freeze({ body: ['branchId', 'reason', 'allocation'], params: ['taxDocumentId', 'linkId'] }), response: 'Reallocated link projection', capability: 'REVIEW', replay: 'DO_NOT_BLIND_RETRY', errors: Object.freeze(['INPUT_TAX_LINK_ACCESS_FORBIDDEN', 'INPUT_TAX_LINK_BRANCH_FORBIDDEN']) }),
  endpoint({ id: 'receipt-link-cancel', method: 'POST', path: `${TAX_INTAKE_BASE}/documents/:taxDocumentId/receipt-links/:linkId/cancel`, request: Object.freeze({ body: ['branchId', 'reason'], params: ['taxDocumentId', 'linkId'] }), response: 'Cancelled link projection', capability: 'REVIEW', replay: 'DO_NOT_BLIND_RETRY', errors: Object.freeze(['INPUT_TAX_LINK_ACCESS_FORBIDDEN', 'INPUT_TAX_LINK_BRANCH_FORBIDDEN', 'INPUT_TAX_REASON_REQUIRED']) }),
  endpoint({ id: 'duplicate-decision', method: 'POST', path: `${TAX_INTAKE_BASE}/documents/:taxDocumentId/duplicate-decision`, request: Object.freeze({ body: ['branchId', 'decision', 'reason', 'evidence'], params: ['taxDocumentId'] }), response: 'Duplicate decision projection with replayed flag', capability: 'DECIDE_DUPLICATE', replay: 'MUTATION_REPLAY_SAFE', errors: Object.freeze(['INPUT_TAX_DECISION_ACCESS_FORBIDDEN', 'INPUT_TAX_DECISION_BRANCH_FORBIDDEN', 'INPUT_TAX_DECISION_ACTOR_REQUIRED', 'INPUT_TAX_DECISION_REASON_REQUIRED']) }),
  endpoint({ id: 'replacement-link', method: 'POST', path: `${TAX_INTAKE_BASE}/documents/:taxDocumentId/replacement-link`, request: Object.freeze({ body: ['branchId', 'replacesTaxDocumentId', 'reason', 'evidence'], params: ['taxDocumentId'] }), response: 'Replacement decision projection with replayed flag', capability: 'DECIDE_REPLACEMENT', replay: 'MUTATION_REPLAY_SAFE', errors: Object.freeze(['INPUT_TAX_REPLACEMENT_SELF_REFERENCE', 'INPUT_TAX_REPLACEMENT_ALREADY_LINKED', 'INPUT_TAX_REPLACEMENT_CYCLE', 'INPUT_TAX_DECISION_REASON_REQUIRED']) }),
  endpoint({ id: 'filing-select', method: 'POST', path: `${TAX_INTAKE_BASE}/input-documents/filing/batches/:batchId/documents/:taxDocumentId/select`, request: Object.freeze({ body: ['branchId'], params: ['batchId', 'taxDocumentId'] }), response: 'InputTaxFilingItem projection with version and replayed', capability: 'SELECT_FOR_FILING', replay: 'MUTATION_REPLAY_SAFE', concurrency: Object.freeze({ rowLock: true, versionField: 'version' }), errors: Object.freeze(['INPUT_TAX_FILING_RECONCILIATION_REQUIRED', 'INPUT_TAX_FILING_ELIGIBILITY_REQUIRED', 'INPUT_TAX_DOCUMENT_ALREADY_IN_FILING', 'INPUT_TAX_FILING_BATCH_BRANCH_MISMATCH']) }),
  endpoint({ id: 'filing-remove', method: 'POST', path: `${TAX_INTAKE_BASE}/input-documents/filing/batches/:batchId/documents/:taxDocumentId/remove`, request: Object.freeze({ body: ['branchId', 'reason', 'version|expectedVersion'], params: ['batchId', 'taxDocumentId'] }), response: 'Removed InputTaxFilingItem projection with incremented version and replayed', capability: 'REMOVE_FROM_FILING', replay: 'MUTATION_REPLAY_SAFE', concurrency: Object.freeze({ versionField: 'version|expectedVersion' }), errors: Object.freeze(['INPUT_TAX_REASON_REQUIRED', 'INPUT_TAX_STALE_VERSION', 'INPUT_TAX_FILING_BATCH_NOT_MUTABLE']) }),
  endpoint({ id: 'filing-submit', method: 'POST', path: `${TAX_INTAKE_BASE}/input-documents/filing/batches/:batchId/file`, request: Object.freeze({ body: ['branchId', 'filedAt?'], params: ['batchId'] }), response: 'Submitted batch result with affectedDocumentCount and replayed; LOCKED tax period permits submit but still blocks select/remove', capability: 'FILE', replay: 'MUTATION_REPLAY_SAFE', errors: Object.freeze(['INPUT_TAX_FILING_STALE', 'INPUT_TAX_FILING_BATCH_NOT_MUTABLE', 'INPUT_TAX_PERIOD_MUTATION_BLOCKED']) }),
  endpoint({ id: 'tax-period-list', method: 'GET', path: `${TAX_PERIOD_BASE}/periods`, request: Object.freeze({ query: ['branchId', 'status', 'fromDate', 'toDate'] }), response: 'Tax period list', capability: 'VIEW_PERIOD', replay: 'READ_RETRY_SAFE', errors: Object.freeze([]) }),
  endpoint({ id: 'tax-period-summary', method: 'GET', path: `${TAX_PERIOD_BASE}/periods/summary`, request: Object.freeze({ query: ['branchId', 'referenceDate?'] }), response: 'Tax period summary', capability: 'VIEW_PERIOD', replay: 'READ_RETRY_SAFE', errors: Object.freeze([]) }),
  endpoint({ id: 'tax-period-detail', method: 'GET', path: `${TAX_PERIOD_BASE}/periods/:taxPeriodId`, request: Object.freeze({ query: ['branchId'], params: ['taxPeriodId'] }), response: 'TaxPeriod detail with availableActions', capability: 'VIEW_PERIOD', replay: 'READ_RETRY_SAFE', errors: Object.freeze([]) }),
  endpoint({ id: 'tax-period-transition', method: 'POST', path: `${TAX_PERIOD_BASE}/periods/:taxPeriodId/:action`, request: Object.freeze({ body: ['branchId', 'occurredAt?'], params: ['taxPeriodId', 'action=close|lock|submit|reopen'] }), response: 'TaxPeriod transition result with replayed; lock requires complete input/output filing selection and submit requires submitted input/output filing batches', capability: 'ADMINISTER_PERIOD', replay: 'MUTATION_REPLAY_SAFE', concurrency: Object.freeze({ compareAndSet: true }), errors: Object.freeze(['TAX_PERIOD_STALE_VERSION', 'TAX_PERIOD_INPUT_FILING_INCOMPLETE', 'TAX_PERIOD_INPUT_FILING_NOT_SUBMITTED']) }),
  endpoint({ id: 'accounting-office-package', method: 'GET', path: `${TAX_PERIOD_BASE}/accounting-office/packages/:taxPeriodId`, request: Object.freeze({ query: ['branchId'], params: ['taxPeriodId'] }), response: 'Accounting-office package for the tax period', capability: 'GENERATE_AUDIT_PACKAGE_READ', replay: 'READ_RETRY_SAFE', errors: Object.freeze([]) }),
  endpoint({ id: 'input-vat-report', method: 'GET', path: INPUT_TAX_REPORT_BASE, request: Object.freeze({ query: ['startDate+endDate OR month+year'] }), response: 'Input VAT report; InputVatRecord primary with legacy receipt compatibility fallback', capability: 'VIEW_REPORT', replay: 'READ_RETRY_SAFE', bounds: Object.freeze({ maxRangeDays: 366, maxRows: 2000, overflowRefused: true }), errors: Object.freeze(['INPUT_TAX_REPORT_RANGE_TOO_LARGE', 'INPUT_TAX_REPORT_RESULT_TOO_LARGE']) }),
]);

const compatibilityAliases = Object.freeze([
  Object.freeze({ canonicalBase: TAX_INTAKE_BASE, aliasBase: '/api/tax', status: 'PRESERVE_UNTIL_HISTORICAL_DEPENDENCY_AUDITED' }),
  Object.freeze({ canonicalBase: TAX_PERIOD_BASE, aliasBase: '/api/tax', status: 'PRESERVE_UNTIL_HISTORICAL_DEPENDENCY_AUDITED' }),
]);

const unavailableSurfaces = Object.freeze([
  Object.freeze({ id: 'investigation-workspace', reason: 'No concrete HTTP endpoint verified in continuation branch' }),
  Object.freeze({ id: 'supplier-tax-health', reason: 'No concrete HTTP endpoint verified in continuation branch' }),
  Object.freeze({ id: 'executive-overview-dedicated', reason: 'Input Tax Overview exists; no separate dedicated endpoint verified' }),
  Object.freeze({ id: 'filing-simulation-dedicated', reason: 'No dedicated simulation endpoint verified in continuation branch' }),
]);

module.exports = Object.freeze({
  CONTRACT_VERSION,
  INPUT_TAX_REPORT_BASE,
  InputTaxFrontendErrorCode,
  TAX_INTAKE_BASE,
  TAX_PERIOD_BASE,
  commonAuthority,
  compatibilityAliases,
  endpoints,
  unavailableSurfaces,
});