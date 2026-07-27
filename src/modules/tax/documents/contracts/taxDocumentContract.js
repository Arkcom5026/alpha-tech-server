'use strict';

const TAX_DOCUMENT_TYPES = Object.freeze([
  'OUTPUT_TAX_INVOICE',
  'INPUT_TAX_INVOICE',
  'DEBIT_NOTE',
  'CREDIT_NOTE',
  'RECEIPT',
  'OTHER',
]);

const TAX_DOCUMENT_STATUSES = Object.freeze([
  'DRAFT',
  'REGISTERED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);

const normalizeText = (value) => String(value || '').trim();

const buildTaxDocumentIdentity = ({ branchId, documentType, documentNumber, issuerTaxId }) => {
  const normalizedBranchId = Number(branchId);
  const normalizedType = normalizeText(documentType).toUpperCase();
  const normalizedNumber = normalizeText(documentNumber).toUpperCase();
  const normalizedIssuerTaxId = normalizeText(issuerTaxId).replace(/\D/g, '');

  if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
    throw Object.assign(new Error('branchId must be a positive integer'), { code: 'TAX_DOCUMENT_BRANCH_REQUIRED' });
  }
  if (!TAX_DOCUMENT_TYPES.includes(normalizedType)) {
    throw Object.assign(new Error('Unsupported tax document type'), { code: 'TAX_DOCUMENT_TYPE_INVALID' });
  }
  if (!normalizedNumber) {
    throw Object.assign(new Error('documentNumber is required'), { code: 'TAX_DOCUMENT_NUMBER_REQUIRED' });
  }

  return Object.freeze({
    branchId: normalizedBranchId,
    documentType: normalizedType,
    documentNumber: normalizedNumber,
    issuerTaxId: normalizedIssuerTaxId || null,
    identityKey: [normalizedBranchId, normalizedType, normalizedIssuerTaxId || '-', normalizedNumber].join(':'),
  });
};

module.exports = Object.freeze({
  TAX_DOCUMENT_STATUSES,
  TAX_DOCUMENT_TYPES,
  buildTaxDocumentIdentity,
});
