'use strict';

const { buildTaxDocumentIdentity } = require('../../documents/contracts/taxDocumentContract');

const SOURCE_TO_DOCUMENT_TYPE = Object.freeze({
  SALE: 'OUTPUT_TAX_INVOICE',
  DOCUMENT_PREPARATION: 'OUTPUT_TAX_INVOICE',
  CUSTOMER_RECEIPT: 'RECEIPT',
  PURCHASE_RECEIPT: 'INPUT_TAX_INVOICE',
  SALE_RETURN: 'CREDIT_NOTE',
  SUPPLIER_PAYMENT: 'OTHER',
  SERVICE_ORDER: 'OUTPUT_TAX_INVOICE',
  REPAIR_JOB: 'OUTPUT_TAX_INVOICE',
  MANUAL: 'OTHER',
});

const mapCandidateToTaxDocumentDraft = ({
  candidate,
  documentNumber,
  issuerTaxId,
  counterpartyTaxId,
  documentType,
}) => {
  if (!candidate || typeof candidate !== 'object') {
    throw Object.assign(new Error('candidate is required'), { code: 'TAX_CANDIDATE_REQUIRED' });
  }

  const resolvedDocumentType = String(documentType || SOURCE_TO_DOCUMENT_TYPE[candidate.sourceType] || 'OTHER').toUpperCase();
  const resolvedDocumentNumber = documentNumber || candidate.sourceDocumentNo;
  const identity = buildTaxDocumentIdentity({
    branchId: candidate.branchId,
    documentType: resolvedDocumentType,
    documentNumber: resolvedDocumentNumber,
    issuerTaxId,
  });

  return Object.freeze({
    ...identity,
    counterpartyTaxId: String(counterpartyTaxId || '').trim().replace(/\D/g, '') || null,
    status: 'DRAFT',
    sourceType: candidate.sourceType,
    sourceId: candidate.sourceId,
    sourceCandidateKey: candidate.registrationKey,
    documentDate: candidate.occurredAt,
    sourceSnapshot: candidate.snapshot || Object.freeze({}),
  });
};

module.exports = Object.freeze({
  SOURCE_TO_DOCUMENT_TYPE,
  mapCandidateToTaxDocumentDraft,
});
