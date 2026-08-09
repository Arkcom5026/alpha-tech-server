'use strict';

const { Prisma } = require('../../../../lib/prisma');

const ISSUED_STATUSES = Object.freeze(['REGISTERED', 'UNDER_REVIEW', 'APPROVED']);
const USABLE_PERIOD_STATUSES = Object.freeze(['OPEN', 'REOPENED']);

const fail = (code, message, statusCode = 409) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const requireIssuedDocument = (document, branchId) => {
  if (!document || Number(document.branchId) !== Number(branchId)) {
    fail('OUTPUT_VAT_DOCUMENT_BRANCH_MISMATCH', 'Issued tax document does not belong to the requested branch');
  }
  if (!ISSUED_STATUSES.includes(document.status)
    || !document.issuedAt
    || !document.issuerProfileId
    || !document.issuedDocumentNumber) {
    fail('OUTPUT_VAT_DOCUMENT_NOT_ISSUED', 'Output VAT can only be recorded from an issued tax document');
  }
};

const replayKeyFor = (document) => `OUTPUT_VAT:${Number(document.branchId)}:${Number(document.id)}`;

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

const createOutputVatRecordService = () => {
  const recordIssuedDocument = async ({ tx, branchId, document, ledgerType }) => {
    if (!tx?.outputVatRecord) throw new TypeError('transaction outputVatRecord repository is required');
    requireIssuedDocument(document, branchId);

    const expectedLedgerType = document.documentType === 'OUTPUT_TAX_CREDIT_NOTE'
      ? 'OUTPUT_VAT_ADJUSTMENT'
      : 'OUTPUT_VAT';
    if (ledgerType && ledgerType !== expectedLedgerType) {
      fail('OUTPUT_VAT_LEDGER_TYPE_MISMATCH', 'Output VAT ledger type does not match the tax document');
    }

    const existing = await tx.outputVatRecord.findUnique({
      where: { taxDocumentId: Number(document.id) },
    });
    if (existing) {
      if (Number(existing.branchId) !== Number(branchId) || existing.ledgerType !== expectedLedgerType) {
        fail('OUTPUT_VAT_REPLAY_CONFLICT', 'Existing Output VAT authority conflicts with the issued document');
      }
      return Object.freeze({ replayed: true, record: existing });
    }

    const documentDate = new Date(document.issuedAt);
    const period = await resolvePeriod({ tx, branchId, documentDate });
    const recipient = document.recipientSnapshot || document.snapshot?.recipient || {};
    const issuer = document.issuerSnapshot || {};
    const data = {
      branchId: Number(branchId),
      taxDocumentId: Number(document.id),
      taxPeriodId: period?.id || null,
      ledgerType: expectedLedgerType,
      replayKey: replayKeyFor(document),
      documentType: document.documentType,
      taxInvoiceKind: document.taxInvoiceKind || null,
      documentNumber: document.documentNumber,
      issuedDocumentNumber: document.issuedDocumentNumber,
      documentDate,
      currency: document.currency || 'THB',
      subtotalAmount: document.subtotalAmount,
      taxAmount: document.taxAmount,
      totalAmount: document.totalAmount,
      counterpartyName: recipient.legalName || document.snapshot?.counterpartyName || null,
      counterpartyTaxId: recipient.taxId || document.counterpartyTaxId || null,
      counterpartyBranchCode: recipient.branchCode || null,
      issuerSnapshot: issuer,
      recipientSnapshot: document.recipientSnapshot || null,
      documentSnapshot: document.snapshot || {},
      originalTaxDocumentId: document.originalTaxDocumentId || null,
      originalDocumentNumber: issuer.originalIssuedDocumentNumber
        || document.snapshot?.originalIssuedDocumentNumber
        || null,
    };

    try {
      const record = await tx.outputVatRecord.create({ data });
      return Object.freeze({ replayed: false, record });
    } catch (error) {
      if (error?.code !== 'P2002' && !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
      const replay = await tx.outputVatRecord.findUnique({ where: { taxDocumentId: Number(document.id) } });
      if (!replay || Number(replay.branchId) !== Number(branchId)) throw error;
      return Object.freeze({ replayed: true, record: replay });
    }
  };

  return Object.freeze({ recordIssuedDocument });
};

const defaultService = createOutputVatRecordService();

module.exports = Object.freeze({
  ...defaultService,
  ISSUED_STATUSES,
  USABLE_PERIOD_STATUSES,
  createOutputVatRecordService,
  replayKeyFor,
});
