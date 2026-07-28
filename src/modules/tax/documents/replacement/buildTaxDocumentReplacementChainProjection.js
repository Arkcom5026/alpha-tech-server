'use strict';

const normalizeNumber = (value) => (value == null ? null : Number(value));

const buildReplacementReference = (document) => {
  const snapshot = document?.snapshot || {};
  const replacementOf = snapshot.replacementOf || null;

  if (!replacementOf) return null;

  return Object.freeze({
    taxDocumentId: normalizeNumber(replacementOf.taxDocumentId),
    documentNumber: replacementOf.documentNumber || null,
    identityKey: replacementOf.identityKey || null,
    reason: replacementOf.reason || null,
    replacedAt: replacementOf.replacedAt || null,
  });
};

const buildForwardReplacementReference = (document) => {
  const events = Array.isArray(document?.lifecycleEvents) ? document.lifecycleEvents : [];
  const replacementEvent = [...events]
    .reverse()
    .find((event) => event?.metadata?.replacementTaxDocumentId);

  if (!replacementEvent) return null;

  return Object.freeze({
    taxDocumentId: normalizeNumber(replacementEvent.metadata.replacementTaxDocumentId),
    documentNumber: replacementEvent.metadata.replacementDocumentNumber || null,
    reason: replacementEvent.reason || null,
    linkedAt: replacementEvent.occurredAt || replacementEvent.createdAt || null,
  });
};

const buildTaxDocumentReplacementChainProjection = ({ document }) => {
  if (!document) {
    throw Object.assign(new Error('Tax document is required'), {
      code: 'TAX_DOCUMENT_REQUIRED',
      statusCode: 400,
    });
  }

  const replacementOf = buildReplacementReference(document);
  const replacedBy = buildForwardReplacementReference(document);

  return Object.freeze({
    schemaVersion: 'TAX_DOCUMENT_REPLACEMENT_CHAIN_PROJECTION_V1',
    taxDocumentId: normalizeNumber(document.id),
    branchId: normalizeNumber(document.branchId),
    documentType: document.documentType || null,
    documentNumber: document.documentNumber || null,
    status: document.status || null,
    identityKey: document.identityKey || null,
    replacementOf,
    replacedBy,
    isReplacement: Boolean(replacementOf),
    hasReplacement: Boolean(replacedBy),
    chainRole: replacementOf ? 'REPLACEMENT' : replacedBy ? 'REPLACED_ORIGIN' : 'STANDALONE',
  });
};

module.exports = Object.freeze({ buildTaxDocumentReplacementChainProjection });
