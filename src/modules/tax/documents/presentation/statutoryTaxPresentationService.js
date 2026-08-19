'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { getOrCreatePresentationSnapshot } = require('../../../document-presentation/persistentPresentationSnapshotService');

const STATUTORY_PURPOSES = new Set(['FULL_TAX_INVOICE', 'SHORT_TAX_INVOICE', 'CREDIT_NOTE']);

const positiveInt = (value, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new TypeError(`${field} is required`);
  return parsed;
};

const resolveStatutoryPurpose = ({ documentType, taxInvoiceKind }) => {
  if (documentType === 'OUTPUT_TAX_CREDIT_NOTE') return 'CREDIT_NOTE';
  if (documentType !== 'OUTPUT_TAX_INVOICE') return null;
  return taxInvoiceKind === 'FULL' ? 'FULL_TAX_INVOICE' : taxInvoiceKind === 'SHORT' ? 'SHORT_TAX_INVOICE' : null;
};

const ensureStatutoryTaxPresentationSnapshot = async ({
  tx = prisma,
  branchId,
  taxDocument,
} = {}) => {
  const normalizedBranchId = positiveInt(branchId, 'branchId');
  const documentId = positiveInt(taxDocument?.id, 'taxDocument.id');
  const documentPurpose = resolveStatutoryPurpose(taxDocument || {});
  if (!STATUTORY_PURPOSES.has(documentPurpose)) {
    throw new TypeError('Unsupported statutory document purpose');
  }
  if (taxDocument?.status !== 'REGISTERED' || !taxDocument?.issuedAt || !taxDocument?.issuerSnapshot) {
    throw new TypeError('Registered statutory tax authority snapshot is required');
  }

  const branch = await tx.branch.findFirst({
    where: { id: normalizedBranchId },
    select: { id: true, documentHeaderConfig: true },
  });
  if (!branch) throw new TypeError('Owning branch is required');

  const record = await getOrCreatePresentationSnapshot({
    tx,
    branchId: normalizedBranchId,
    sourceType: 'TAX_DOCUMENT',
    sourceId: documentId,
    documentPurpose,
    rendererFamily: documentPurpose === 'SHORT_TAX_INVOICE' ? 'THERMAL_80MM' : 'A4',
    storeConfig: branch.documentHeaderConfig || null,
    issuedAt: taxDocument.issuedAt,
    businessSnapshot: {
      taxDocumentId: documentId,
      documentType: taxDocument.documentType,
      taxInvoiceKind: taxDocument.taxInvoiceKind || null,
      issuedDocumentNumber: taxDocument.issuedDocumentNumber,
      issuerSnapshot: taxDocument.issuerSnapshot,
      recipientSnapshot: taxDocument.recipientSnapshot || null,
    },
  });

  return record;
};

module.exports = Object.freeze({
  ensureStatutoryTaxPresentationSnapshot,
  resolveStatutoryPurpose,
});
