'use strict';

const { buildTaxDocumentOperationalReadinessProjection } = require('../readiness/buildTaxDocumentOperationalReadinessProjection');
const { buildTaxDocumentPrintProjection } = require('../print/buildTaxDocumentPrintProjection');
const { buildTaxDocumentTimelineProjection } = require('../timeline/buildTaxDocumentTimelineProjection');
const {
  buildTaxDocumentReplacementChainProjection,
} = require('../replacement/buildTaxDocumentReplacementChainProjection');

const normalizeNumber = (value) => (value == null ? null : Number(value));

const buildTaxDocumentWorkspaceProjection = ({ document }) => {
  if (!document) {
    throw Object.assign(new Error('Tax document is required'), {
      code: 'TAX_DOCUMENT_REQUIRED',
      statusCode: 400,
    });
  }

  const operationalReadiness = buildTaxDocumentOperationalReadinessProjection({ document });
  const timeline = buildTaxDocumentTimelineProjection({ document });
  const replacementChain = buildTaxDocumentReplacementChainProjection({ document });
  const printProjection = buildTaxDocumentPrintProjection({ document });

  return Object.freeze({
    schemaVersion: 'TAX_DOCUMENT_WORKSPACE_PROJECTION_V1',
    taxDocumentId: normalizeNumber(document.id),
    branchId: normalizeNumber(document.branchId),
    candidateId: normalizeNumber(document.candidateId),
    documentType: document.documentType || null,
    documentNumber: document.documentNumber || null,
    status: document.status || null,
    issuedAt: document.issuedAt || null,
    occurredAt: document.occurredAt || null,
    amounts: Object.freeze({
      currency: document.currency || 'THB',
      subtotalAmount: Number(document.subtotalAmount || 0),
      taxAmount: Number(document.taxAmount || 0),
      totalAmount: Number(document.totalAmount || 0),
    }),
    source: Object.freeze({
      sourceType: document.candidate?.sourceType || document.snapshot?.source?.type || null,
      sourceId: document.candidate?.sourceId || document.snapshot?.source?.id || null,
      sourceDocumentNo:
        document.candidate?.sourceDocumentNo ||
        document.snapshot?.source?.officialDocumentNumber ||
        document.snapshot?.source?.code ||
        null,
    }),
    actions: Object.freeze({
      canIssue: operationalReadiness.canIssue,
      canPrintFinal: operationalReadiness.canPrintFinal,
      canCancel: operationalReadiness.canCancel,
      canReplace: operationalReadiness.canReplace,
    }),
    operationalReadiness,
    timeline,
    replacementChain,
    printProjection,
  });
};

module.exports = Object.freeze({ buildTaxDocumentWorkspaceProjection });
