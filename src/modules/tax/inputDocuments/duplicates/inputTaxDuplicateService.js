'use strict';

const crypto = require('crypto');
const { createDuplicateProjection } = require('./inputTaxDuplicateContract');

const normalizeText = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
const normalizeDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};
const normalizeMoney = (value) => Number(value || 0).toFixed(2);

const duplicateComponents = (document) => Object.freeze({
  counterpartyTaxId: normalizeText(document.counterpartyTaxId || document.snapshot?.supplierTaxId),
  counterpartyBranch: normalizeText(document.snapshot?.supplierBranch || document.snapshot?.issuerBranch),
  documentType: normalizeText(document.documentType),
  documentNumber: normalizeText(document.documentNumber),
  documentDate: normalizeDate(document.issuedAt || document.occurredAt),
  subtotalAmount: normalizeMoney(document.subtotalAmount),
  vatAmount: normalizeMoney(document.vatAmount),
  totalAmount: normalizeMoney(document.totalAmount),
});

const createFingerprint = (document) => {
  const components = duplicateComponents(document);
  return crypto.createHash('sha256').update(JSON.stringify(components)).digest('hex');
};

const projectInputTaxDuplicates = (documents = []) => {
  const groups = new Map();
  documents.forEach((document) => {
    const fingerprint = createFingerprint(document);
    const rows = groups.get(fingerprint) || [];
    rows.push(document);
    groups.set(fingerprint, rows);
  });

  return new Map(documents.map((document) => {
    const fingerprint = createFingerprint(document);
    const group = groups.get(fingerprint) || [];
    const matchedDocumentIds = group.filter((row) => row.id !== document.id).map((row) => row.id);
    const manualStatus = normalizeText(document.snapshot?.inputTaxDuplicateStatus);
    const status = manualStatus === 'CONFIRMED_DUPLICATE' || manualStatus === 'RESOLVED_NOT_DUPLICATE'
      ? manualStatus
      : (matchedDocumentIds.length > 0 ? 'HIGH_CONFIDENCE_DUPLICATE' : 'NONE');
    return [document.id, createDuplicateProjection({
      status,
      fingerprint,
      matchedDocumentIds,
      matchedFields: matchedDocumentIds.length > 0
        ? ['COUNTERPARTY_TAX_ID', 'DOCUMENT_TYPE', 'DOCUMENT_NUMBER', 'DOCUMENT_DATE', 'SUBTOTAL_AMOUNT', 'VAT_AMOUNT', 'TOTAL_AMOUNT']
        : [],
    })];
  }));
};

module.exports = Object.freeze({ createFingerprint, duplicateComponents, projectInputTaxDuplicates });
