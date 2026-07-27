'use strict';

const TRANSITIONS = Object.freeze({
  DRAFT: Object.freeze(['REGISTERED', 'CANCELLED']),
  REGISTERED: Object.freeze(['UNDER_REVIEW', 'CANCELLED']),
  UNDER_REVIEW: Object.freeze(['APPROVED', 'REJECTED', 'CANCELLED']),
  REJECTED: Object.freeze(['UNDER_REVIEW', 'CANCELLED']),
  APPROVED: Object.freeze(['CANCELLED']),
  CANCELLED: Object.freeze([]),
});

const assertTaxDocumentTransition = ({ currentStatus, targetStatus }) => {
  const current = String(currentStatus || '').trim().toUpperCase();
  const target = String(targetStatus || '').trim().toUpperCase();

  if (current === target) {
    return Object.freeze({ allowed: true, replayed: true, currentStatus: current, targetStatus: target });
  }

  if (!(TRANSITIONS[current] || []).includes(target)) {
    throw Object.assign(new Error(`Cannot transition tax document from ${current || 'UNKNOWN'} to ${target || 'UNKNOWN'}`), {
      code: 'TAX_DOCUMENT_TRANSITION_FORBIDDEN',
      statusCode: 409,
    });
  }

  return Object.freeze({ allowed: true, replayed: false, currentStatus: current, targetStatus: target });
};

module.exports = Object.freeze({
  TRANSITIONS,
  assertTaxDocumentTransition,
});
