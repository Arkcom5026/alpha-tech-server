'use strict';

const InputTaxRetentionClass = Object.freeze({
  AUTHORITY_IMMUTABLE: 'AUTHORITY_IMMUTABLE',
  AUDIT_APPEND_ONLY: 'AUDIT_APPEND_ONLY',
  OPERATIONAL_MUTABLE: 'OPERATIONAL_MUTABLE',
});

const InputTaxRetryClass = Object.freeze({
  READ_RETRY_SAFE: 'READ_RETRY_SAFE',
  MUTATION_REPLAY_SAFE: 'MUTATION_REPLAY_SAFE',
  CONFLICT_REQUIRES_REFRESH: 'CONFLICT_REQUIRES_REFRESH',
  DO_NOT_BLIND_RETRY: 'DO_NOT_BLIND_RETRY',
});

const RETENTION_POLICY = Object.freeze({
  InputVatRecord: InputTaxRetentionClass.AUTHORITY_IMMUTABLE,
  TaxDocumentLifecycleEvent: InputTaxRetentionClass.AUDIT_APPEND_ONLY,
  duplicateDecisionHistory: InputTaxRetentionClass.AUDIT_APPEND_ONLY,
  replacementHistory: InputTaxRetentionClass.AUDIT_APPEND_ONLY,
  filingEvidence: InputTaxRetentionClass.AUDIT_APPEND_ONLY,
  investigationResolutionEvidence: InputTaxRetentionClass.AUDIT_APPEND_ONLY,
  auditPackageMetadata: InputTaxRetentionClass.AUDIT_APPEND_ONLY,
});

const RETRY_POLICY = Object.freeze({
  INPUT_TAX_READ: InputTaxRetryClass.READ_RETRY_SAFE,
  INPUT_TAX_REPORT_READ: InputTaxRetryClass.READ_RETRY_SAFE,
  INPUT_TAX_DUPLICATE_DECISION: InputTaxRetryClass.MUTATION_REPLAY_SAFE,
  INPUT_TAX_REPLACEMENT_LINK: InputTaxRetryClass.MUTATION_REPLAY_SAFE,
  INPUT_TAX_FILING_SELECT: InputTaxRetryClass.MUTATION_REPLAY_SAFE,
  INPUT_TAX_FILING_REMOVE: InputTaxRetryClass.CONFLICT_REQUIRES_REFRESH,
  INPUT_TAX_FILING_SUBMIT: InputTaxRetryClass.MUTATION_REPLAY_SAFE,
  INPUT_TAX_PERIOD_TRANSITION: InputTaxRetryClass.CONFLICT_REQUIRES_REFRESH,
  INPUT_TAX_UNKNOWN_MUTATION: InputTaxRetryClass.DO_NOT_BLIND_RETRY,
});

const classifyRetry = (operation) => RETRY_POLICY[operation] || InputTaxRetryClass.DO_NOT_BLIND_RETRY;
const classifyRetention = (resource) => RETENTION_POLICY[resource] || InputTaxRetentionClass.OPERATIONAL_MUTABLE;

module.exports = Object.freeze({
  InputTaxRetentionClass,
  InputTaxRetryClass,
  RETENTION_POLICY,
  RETRY_POLICY,
  classifyRetention,
  classifyRetry,
});
