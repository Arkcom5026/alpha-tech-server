'use strict';

const ELIGIBILITY_STATUSES = Object.freeze([
  'PENDING_REVIEW',
  'ELIGIBLE',
  'PARTIALLY_ELIGIBLE',
  'INELIGIBLE',
  'DEFERRED',
  'SELECTED_FOR_FILING',
  'FILED',
]);

const ELIGIBILITY_REASON_CODES = Object.freeze([
  'MISSING_REQUIRED_FIELD',
  'DUPLICATE_DOCUMENT_RISK',
  'ALLOCATION_MISMATCH',
  'PROHIBITED_INPUT_TAX',
  'PARTIAL_BUSINESS_USE',
  'OUTSIDE_CLAIM_WINDOW',
  'CANCELLED_DOCUMENT',
  'REPLACED_DOCUMENT',
  'MANUAL_REVIEW_REQUIRED',
]);

const money = (value) => Number(value || 0).toFixed(2);
const percentage = (value) => Number(value || 0).toFixed(4);

const createEligibilityProjection = ({
  status,
  grossVatAmount,
  eligibleVatAmount,
  ineligibleVatAmount,
  eligibilityRate,
  reasonCodes = [],
  decidedAt = null,
  decidedByEmployeeId = null,
}) => Object.freeze({
  status,
  grossVatAmount: money(grossVatAmount),
  eligibleVatAmount: money(eligibleVatAmount),
  ineligibleVatAmount: money(ineligibleVatAmount),
  eligibilityRate: percentage(eligibilityRate),
  reasonCodes: Object.freeze([...reasonCodes]),
  decidedAt,
  decidedByEmployeeId,
  canSelectForFiling: ['ELIGIBLE', 'PARTIALLY_ELIGIBLE'].includes(status)
    && Number(eligibleVatAmount || 0) > 0,
});

module.exports = Object.freeze({
  ELIGIBILITY_REASON_CODES,
  ELIGIBILITY_STATUSES,
  createEligibilityProjection,
});