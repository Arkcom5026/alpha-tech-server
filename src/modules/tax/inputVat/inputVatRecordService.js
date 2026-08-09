'use strict';

const { Prisma } = require('../../../../lib/prisma');

const APPROVED_STATUS = 'APPROVED';
const USABLE_PERIOD_STATUSES = Object.freeze(['OPEN', 'REOPENED']);

const fail = (code, message, statusCode = 409) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const requireApprovedInputDocument = (document, branchId) => {
  if (!document || Number(document.branchId) !== Number(branchId)) {
    fail('INPUT_VAT_DOCUMENT_BRANCH_MISMATCH', 'Input tax document does not belong to the requested branch');
  }
  if (document.documentType !== 'INPUT_TAX_INVOICE' || document.status !== APPROVED_STATUS) {
    fail('INPUT_VAT_DOCUMENT_NOT_APPROVED', 'Input VAT can only be recorded from an approved input tax invoice');
  }
};

const replayKeyFor = (document) => `INPUT_VAT:${Number(document.branchId)}:${Number(document.id)}`;

const resolvePeriod = ({ tx, branchId, documentDate }) => tx.taxPeriod.findFirst({
  where: {
    branchId: Number(branchId),
    status: { in: USABLE_PERIOD_STATUSES },
    startDate: { lte: documentDate },
    endDate: { gte: documentDate },
  },
  orderBy: { startDate: 'desc' },
  select: { id: true, branchId: true },
});

const createInputVatRecordService = () => {
  const recordApprovedDocument = async ({ tx, branchId, document }) => {
    if (!tx?.inputVatRecord) throw new TypeError('transaction inputVatRecord repository is required');
    requireApprovedInputDocument(document, branchId);

    const expectedLedgerType = document.originalTaxDocumentId ? 'INPUT_VAT_ADJUSTMENT' : 'INPUT_VAT';
    const existing = await tx.inputVatRecord.findUnique({ where: { taxDocumentId: Number(document.id) } });
    if (existing) {
      if (Number(existing.branchId) !== Number(branchId) || existing.ledgerType !== expectedLedgerType) {
        fail('INPUT_VAT_REPLAY_CONFLICT', 'Existing Input VAT authority conflicts with the approved document');
      }
      return Object.freeze({ replayed: true, record: existing });
    }

    const snapshot = document.snapshot || {};
    const supplier = snapshot.supplier || snapshot.counterparty || {};
    const documentDate = new Date(snapshot.supplierTaxInvoiceDate || snapshot.documentDate || document.occurredAt);
    const period = await resolvePeriod({ tx, branchId, documentDate });
    const data = {
      branchId: Number(branchId),
      taxDocumentId: Number(document.id),
      taxPeriodId: period?.id || null,
      ledgerType: expectedLedgerType,
      replayKey: replayKeyFor(document),
      documentType: document.documentType,
      documentNumber: document.documentNumber,
      documentDate,
      currency: document.currency || 'THB',
      subtotalAmount: document.subtotalAmount,
      taxAmount: document.taxAmount,
      totalAmount: document.totalAmount,
      supplierName: supplier.name || supplier.legalName || snapshot.supplierName || null,
      supplierTaxId: supplier.taxId || document.counterpartyTaxId || snapshot.supplierTaxId || null,
      supplierBranchCode: supplier.branchCode || snapshot.supplierBranchCode || null,
      documentSnapshot: snapshot,
      originalTaxDocumentId: document.originalTaxDocumentId || null,
      originalDocumentNumber: snapshot.originalDocumentNumber || null,
    };

    try {
      const record = await tx.inputVatRecord.create({ data });
      return Object.freeze({ replayed: false, record });
    } catch (error) {
      if (error?.code !== 'P2002' && !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
      const replay = await tx.inputVatRecord.findUnique({ where: { taxDocumentId: Number(document.id) } });
      if (!replay || Number(replay.branchId) !== Number(branchId)) throw error;
      return Object.freeze({ replayed: true, record: replay });
    }
  };

  return Object.freeze({ recordApprovedDocument });
};

const defaultService = createInputVatRecordService();

module.exports = Object.freeze({
  ...defaultService,
  APPROVED_STATUS,
  USABLE_PERIOD_STATUSES,
  createInputVatRecordService,
  replayKeyFor,
});
