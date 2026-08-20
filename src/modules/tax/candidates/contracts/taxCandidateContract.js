'use strict';

const TAX_CANDIDATE_SOURCE_TYPES = Object.freeze([
  'SALE',
  'DOCUMENT_PREPARATION',
  'CONSOLIDATED_DELIVERY',
  'CUSTOMER_RECEIPT',
  'PURCHASE_RECEIPT',
  'SALE_RETURN',
  'SUPPLIER_PAYMENT',
  'SERVICE_ORDER',
  'REPAIR_JOB',
  'MANUAL',
]);

const TAX_CANDIDATE_STATUSES = Object.freeze([
  'REGISTERED',
  'MAPPED',
  'REJECTED',
  'CONVERTED',
]);

const normalizeRequiredText = (value, code, fieldName) => {
  const normalized = String(value || '').trim();
  if (!normalized) throw Object.assign(new Error(`${fieldName} is required`), { code });
  return normalized;
};

const buildTaxCandidateRegistration = ({ branchId, sourceType, sourceId, sourceDocumentNo, occurredAt, snapshot }) => {
  const normalizedBranchId = Number(branchId);
  const normalizedSourceType = String(sourceType || '').trim().toUpperCase();

  if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
    throw Object.assign(new Error('branchId must be a positive integer'), { code: 'TAX_CANDIDATE_BRANCH_REQUIRED' });
  }
  if (!TAX_CANDIDATE_SOURCE_TYPES.includes(normalizedSourceType)) {
    throw Object.assign(new Error('Unsupported candidate source type'), { code: 'TAX_CANDIDATE_SOURCE_TYPE_INVALID' });
  }

  const normalizedSourceId = normalizeRequiredText(sourceId, 'TAX_CANDIDATE_SOURCE_ID_REQUIRED', 'sourceId');
  const eventTime = occurredAt ? new Date(occurredAt) : new Date();
  if (Number.isNaN(eventTime.getTime())) {
    throw Object.assign(new Error('occurredAt is invalid'), { code: 'TAX_CANDIDATE_OCCURRED_AT_INVALID' });
  }

  return Object.freeze({
    branchId: normalizedBranchId,
    sourceType: normalizedSourceType,
    sourceId: normalizedSourceId,
    sourceDocumentNo: String(sourceDocumentNo || '').trim() || null,
    occurredAt: eventTime.toISOString(),
    snapshot: snapshot && typeof snapshot === 'object' ? Object.freeze({ ...snapshot }) : Object.freeze({}),
    registrationKey: [normalizedBranchId, normalizedSourceType, normalizedSourceId].join(':'),
    status: 'REGISTERED',
  });
};

module.exports = Object.freeze({
  TAX_CANDIDATE_SOURCE_TYPES,
  TAX_CANDIDATE_STATUSES,
  buildTaxCandidateRegistration,
});
