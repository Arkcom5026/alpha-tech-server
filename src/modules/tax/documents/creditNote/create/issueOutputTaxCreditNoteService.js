'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');
const { assertOutputTaxCreditNoteEligibility } = require('../saleReturnCreditNoteEligibilityPolicy');
const outputVatRecordService = require('../../../outputVat/outputVatRecordService');
const {
  ensureStatutoryTaxPresentationSnapshot,
} = require('../../presentation/statutoryTaxPresentationService');

const fail = (code, message, statusCode = 409) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const positiveInt = (value, code) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(code, 'A positive integer identity is required', 400);
  return parsed;
};

const selectOriginalForUpdate = async ({ branchId, taxDocumentId }, tx) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "TaxDocument"
    WHERE "id" = ${Number(taxDocumentId)}
      AND "branchId" = ${Number(branchId)}
    LIMIT 1 FOR UPDATE
  `);
  return rows[0] || null;
};

const selectIssuerForUpdate = async ({ branchId }, tx) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "TaxIssuerProfile"
    WHERE "branchId" = ${Number(branchId)}
    LIMIT 1 FOR UPDATE
  `);
  const profile = rows[0] || null;
  if (!profile || profile.status !== 'ACTIVE') {
    fail('TAX_ISSUER_PROFILE_NOT_ACTIVE', 'An active tax issuer profile is required before credit-note issuance');
  }
  return profile;
};

const allocateCreditNoteNumber = async (profile, tx) => {
  const rows = await tx.$queryRawUnsafe(
    `UPDATE "TaxIssuerProfile"
       SET "nextCreditNoteNumber" = "nextCreditNoteNumber" + 1,
           "updatedAt" = CURRENT_TIMESTAMP
     WHERE "id" = $1
     RETURNING "nextCreditNoteNumber"`,
    Number(profile.id),
  );
  const next = Number(rows[0]?.nextCreditNoteNumber);
  const sequence = next - 1;
  if (!Number.isInteger(sequence) || sequence <= 0) {
    fail('TAX_CREDIT_NOTE_SEQUENCE_INVALID', 'Credit-note sequence is invalid');
  }
  const prefix = String(profile.creditNotePrefix || 'CN-').trim();
  return Object.freeze({
    sequence,
    number: `${prefix}${String(sequence).padStart(6, '0')}`,
  });
};

const loadReturnForCreditNote = async ({ branchId, saleReturnId }, tx) => tx.saleReturn.findFirst({
  where: { id: Number(saleReturnId), branchId: Number(branchId) },
  include: {
    sale: {
      select: {
        id: true,
        items: { select: { returnedQuantity: true } },
        simpleItems: { select: { quantity: true, returnedQuantity: true } },
      },
    },
  },
});

const isFullSaleReturn = (sale) => (
  sale.items.every((item) => Number(item.returnedQuantity || 0) >= 1)
  && sale.simpleItems.every((item) => Number(item.returnedQuantity || 0) >= Number(item.quantity || 0))
);

const issueOutputTaxCreditNote = async ({ branchId, taxDocumentId, saleReturnId, actorEmployeeId }) => {
  const normalizedBranchId = positiveInt(branchId, 'TAX_BRANCH_REQUIRED');
  const normalizedDocumentId = positiveInt(taxDocumentId, 'TAX_DOCUMENT_ID_REQUIRED');
  const normalizedSaleReturnId = positiveInt(saleReturnId, 'TAX_CREDIT_NOTE_RETURN_REQUIRED');

  return prisma.$transaction(async (tx) => {
    const original = await selectOriginalForUpdate({
      branchId: normalizedBranchId,
      taxDocumentId: normalizedDocumentId,
    }, tx);
    if (!original) fail('TAX_DOCUMENT_NOT_FOUND', 'Original tax document was not found', 404);

    const existing = await tx.taxDocument.findFirst({
      where: { originalTaxDocumentId: normalizedDocumentId, branchId: normalizedBranchId },
    });
    if (existing) {
      const presentationSnapshot = await ensureStatutoryTaxPresentationSnapshot({
        tx,
        branchId: normalizedBranchId,
        taxDocument: existing,
      });
      const outputVat = await outputVatRecordService.recordIssuedDocument({
        tx,
        branchId: normalizedBranchId,
        document: existing,
        ledgerType: 'OUTPUT_VAT_ADJUSTMENT',
      });
      return Object.freeze({ replayed: true, document: existing, outputVatRecord: outputVat.record, presentationSnapshot });
    }

    const candidate = original.candidateId
      ? await tx.taxCandidate.findUnique({ where: { id: Number(original.candidateId) } })
      : null;
    if (!candidate || candidate.sourceType !== 'SALE') {
      fail('TAX_CREDIT_NOTE_SOURCE_UNSUPPORTED', 'The original tax invoice must be sourced from a sale');
    }
    const saleReturn = await loadReturnForCreditNote({
      branchId: normalizedBranchId,
      saleReturnId: normalizedSaleReturnId,
    }, tx);
    if (!saleReturn || !saleReturn.sale) {
      fail('TAX_CREDIT_NOTE_RETURN_NOT_FOUND', 'Sale return was not found', 404);
    }

    assertOutputTaxCreditNoteEligibility({
      originalTaxDocument: original,
      saleReturn,
      sourceSaleId: candidate?.sourceId,
      isFullSaleReturn: isFullSaleReturn(saleReturn.sale),
    });

    const issuer = await selectIssuerForUpdate({ branchId: normalizedBranchId }, tx);
    const allocation = await allocateCreditNoteNumber(issuer, tx);
    const issuerSnapshot = {
      legalName: issuer.legalName,
      taxId: issuer.taxId,
      registeredAddress: issuer.registeredAddress,
      branchCode: issuer.branchCode,
      isHeadOffice: issuer.isHeadOffice,
      prefix: String(issuer.creditNotePrefix || 'CN-').trim(),
      issuedSequence: allocation.sequence,
      issuedDocumentNumber: allocation.number,
      originalIssuedDocumentNumber: original.issuedDocumentNumber,
    };

    const document = await tx.taxDocument.create({
      data: {
        branchId: normalizedBranchId,
        documentType: 'OUTPUT_TAX_CREDIT_NOTE',
        documentNumber: allocation.number,
        identityKey: `OUTPUT_TAX_CREDIT_NOTE:${normalizedDocumentId}:${normalizedSaleReturnId}`,
        status: 'REGISTERED',
        issuedAt: new Date(),
        occurredAt: saleReturn.completedAt || new Date(),
        currency: original.currency || 'THB',
        subtotalAmount: original.subtotalAmount,
        taxAmount: original.taxAmount,
        totalAmount: original.totalAmount,
        snapshot: {
          source: 'SALE_RETURN_FULL_REFUND',
          originalTaxDocumentId: normalizedDocumentId,
          originalIssuedDocumentNumber: original.issuedDocumentNumber,
          saleReturnId: normalizedSaleReturnId,
          saleId: Number(saleReturn.saleId),
        },
        issuerProfileId: Number(issuer.id),
        issuedDocumentNumber: allocation.number,
        issuedSequence: allocation.sequence,
        issuerSnapshot,
        recipientSnapshot: original.recipientSnapshot,
        counterpartyTaxId: original.counterpartyTaxId,
        originalTaxDocumentId: normalizedDocumentId,
        saleReturnId: normalizedSaleReturnId,
      },
    });

    await tx.taxDocumentLifecycleEvent.create({
      data: {
        taxDocumentId: document.id,
        fromStatus: null,
        toStatus: 'REGISTERED',
        reason: 'Credit note issued after completed full sale return and full refund',
        actorEmployeeId: actorEmployeeId ? Number(actorEmployeeId) : null,
        metadata: {
          branchId: normalizedBranchId,
          originalTaxDocumentId: normalizedDocumentId,
          saleReturnId: normalizedSaleReturnId,
          issuedDocumentNumber: allocation.number,
          issuedSequence: allocation.sequence,
        },
      },
    });

    // Credit-note presentation is frozen atomically with its legal issuance.
    const presentationSnapshot = await ensureStatutoryTaxPresentationSnapshot({
      tx,
      branchId: normalizedBranchId,
      taxDocument: document,
    });

    const outputVat = await outputVatRecordService.recordIssuedDocument({
      tx,
      branchId: normalizedBranchId,
      document,
      ledgerType: 'OUTPUT_VAT_ADJUSTMENT',
    });

    return Object.freeze({ replayed: false, document, outputVatRecord: outputVat.record, presentationSnapshot });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 30000,
  });
};

const issueOutputTaxCreditNoteForSaleReturn = async ({ branchId, saleReturnId, actorEmployeeId }) => {
  const normalizedBranchId = positiveInt(branchId, 'TAX_BRANCH_REQUIRED');
  const normalizedSaleReturnId = positiveInt(saleReturnId, 'TAX_CREDIT_NOTE_RETURN_REQUIRED');

  const saleReturn = await prisma.saleReturn.findFirst({
    where: { id: normalizedSaleReturnId, branchId: normalizedBranchId },
    select: { saleId: true },
  });
  if (!saleReturn) fail('TAX_CREDIT_NOTE_RETURN_NOT_FOUND', 'Sale return was not found', 404);

  const candidate = await prisma.taxCandidate.findFirst({
    where: {
      branchId: normalizedBranchId,
      sourceType: 'SALE',
      sourceId: String(saleReturn.saleId),
    },
    select: { id: true },
  });
  if (!candidate) {
    fail('TAX_CREDIT_NOTE_ORIGINAL_DOCUMENT_NOT_FOUND', 'No sale tax candidate was found for this sale return', 404);
  }

  const original = await prisma.taxDocument.findFirst({
    where: {
      branchId: normalizedBranchId,
      candidateId: candidate.id,
      documentType: 'OUTPUT_TAX_INVOICE',
      status: 'REGISTERED',
    },
    select: { id: true },
  });
  if (!original) {
    fail('TAX_CREDIT_NOTE_ORIGINAL_DOCUMENT_NOT_FOUND', 'No issued output tax invoice was found for this sale return', 404);
  }

  return issueOutputTaxCreditNote({
    branchId: normalizedBranchId,
    taxDocumentId: original.id,
    saleReturnId: normalizedSaleReturnId,
    actorEmployeeId,
  });
};

module.exports = Object.freeze({
  issueOutputTaxCreditNote,
  issueOutputTaxCreditNoteForSaleReturn,
});
