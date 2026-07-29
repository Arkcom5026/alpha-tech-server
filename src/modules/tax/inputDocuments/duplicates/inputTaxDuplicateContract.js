'use strict';

const DUPLICATE_STATUSES = Object.freeze([
  'NONE',
  'POSSIBLE_DUPLICATE',
  'HIGH_CONFIDENCE_DUPLICATE',
  'CONFIRMED_DUPLICATE',
  'RESOLVED_NOT_DUPLICATE',
]);

const DUPLICATE_MATCH_FIELDS = Object.freeze([
  'COUNTERPARTY_TAX_ID',
  'COUNTERPARTY_BRANCH',
  'DOCUMENT_TYPE',
  'DOCUMENT_NUMBER',
  'DOCUMENT_DATE',
  'SUBTOTAL_AMOUNT',
  'VAT_AMOUNT',
  'TOTAL_AMOUNT',
]);

const createDuplicateProjection = ({ status, fingerprint, matchedDocumentIds = [], matchedFields = [] }) => Object.freeze({
  status,
  fingerprint,
  matchedDocumentIds: Object.freeze([...matchedDocumentIds]),
  matchedFields: Object.freeze([...matchedFields]),
  blocksEligibility: ['HIGH_CONFIDENCE_DUPLICATE', 'CONFIRMED_DUPLICATE'].includes(status),
  requiresReview: ['POSSIBLE_DUPLICATE', 'HIGH_CONFIDENCE_DUPLICATE'].includes(status),
});

module.exports = Object.freeze({
  DUPLICATE_MATCH_FIELDS,
  DUPLICATE_STATUSES,
  createDuplicateProjection,
});
