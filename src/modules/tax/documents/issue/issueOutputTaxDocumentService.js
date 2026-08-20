'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');
const documentRepository = require('../repository/taxDocumentRepository');
const { assertSaleTaxDocumentEligibility } = require('../../sources/sale/saleTaxDocumentEligibilityPolicy');
const outputVatRecordService = require('../../outputVat/outputVatRecordService');
const {
  ensureStatutoryTaxPresentationSnapshot,
} = require('../presentation/statutoryTaxPresentationService');

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const normalizeKind = (value) => {
  const kind = String(value || '').trim().toUpperCase();
  if (!['SHORT', 'FULL'].includes(kind)) {
    fail('TAX_INVOICE_KIND_INVALID', 'taxInvoiceKind must be SHORT or FULL');
  }
  return kind;
};

const normalizeText = (value, field) => {
  const normalized = String(value || '').trim();
  if (!normalized) fail('TAX_OUTPUT_RECIPIENT_IDENTITY_INCOMPLETE', `${field} is required for a full tax invoice`, 409);
  return normalized;
};

const normalizeTaxId = (value) => {
  const normalized = String(value || '').replace(/[^0-9]/g, '');
  if (normalized.length !== 13) {
    fail('TAX_OUTPUT_RECIPIENT_IDENTITY_INCOMPLETE', 'recipient taxId must contain exactly 13 digits', 409);
  }
  return normalized;
};

const normalizeRecipient = (recipient) => {
  if (!recipient || typeof recipient !== 'object' || Array.isArray(recipient)) {
    fail('TAX_OUTPUT_RECIPIENT_IDENTITY_INCOMPLETE', 'recipient identity is required for a full tax invoice', 409);
  }
  const branchCode = normalizeText(recipient.branchCode || '00000', 'recipient branchCode');
  if (!/^[0-9]{5}$/.test(branchCode)) {
    fail('TAX_OUTPUT_RECIPIENT_IDENTITY_INCOMPLETE', 'recipient branchCode must contain exactly 5 digits', 409);
  }
  return Object.freeze({
    legalName: normalizeText(recipient.legalName, 'recipient legalName'),
    taxId: normalizeTaxId(recipient.taxId),
    registeredAddress: normalizeText(recipient.registeredAddress, 'recipient registeredAddress'),
    branchCode,
    isHeadOffice: Boolean(recipient.isHeadOffice),
  });
};

const selectActiveIssuerProfileForUpdate = async ({ branchId }, tx) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT *
    FROM "TaxIssuerProfile"
    WHERE "branchId" = ${Number(branchId)}
    FOR UPDATE
  `);
  const profile = rows[0] || null;
  if (!profile || profile.status !== 'ACTIVE') {
    fail('TAX_ISSUER_PROFILE_NOT_ACTIVE', 'An active tax issuer profile is required before issuance', 409);
  }
  return profile;
};

const allocateSequence = async ({ profile, taxInvoiceKind }, tx) => {
  const column = taxInvoiceKind === 'SHORT'
    ? 'nextShortTaxInvoiceNumber'
    : 'nextFullTaxInvoiceNumber';
  const prefix = taxInvoiceKind === 'SHORT'
    ? profile.shortTaxInvoicePrefix
    : profile.fullTaxInvoicePrefix;

  const rows = await tx.$queryRawUnsafe(
    `UPDATE "TaxIssuerProfile"
     SET "${column}" = "${column}" + 1, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "id" = $1
     RETURNING "${column}"`,
    Number(profile.id),
  );
  const next = Number(rows[0]?.[column]);
  const issuedSequence = next - 1;
  if (!Number.isInteger(issuedSequence) || issuedSequence <= 0) {
    fail('TAX_ISSUER_PROFILE_SEQUENCE_INVALID', 'Issuer profile sequence is invalid', 409);
  }
  return Object.freeze({
    issuedSequence,
    issuedDocumentNumber: `${String(prefix || '').trim()}${String(issuedSequence).padStart(6, '0')}`,
  });
};

const assertDocumentPreparationSource = async ({ candidate, branchId }, tx) => {
  const [preparationIdText, portion] = String(candidate.sourceId || '').split(':');
  const preparationId = Number(preparationIdText);
  if (!Number.isInteger(preparationId) || preparationId <= 0 || !['IN_BUDGET', 'OUT_OF_BUDGET'].includes(portion)) {
    fail('TAX_DOCUMENT_PREPARATION_SOURCE_INVALID', 'Document preparation tax source identity is invalid', 409);
  }

  const preparation = await tx.saleDocumentPreparation.findFirst({
    where: { id: preparationId, branchId: Number(branchId), status: 'LOCKED' },
    select: { id: true, sourceId: true, finalSnapshot: true },
  });
  if (!preparation || !preparation.finalSnapshot) {
    fail('TAX_DOCUMENT_PREPARATION_SOURCE_NOT_READY', 'Locked document preparation source is not ready', 409);
  }

  if (Number(candidate.snapshot?.preparationId) !== preparationId || candidate.snapshot?.portion !== portion) {
    fail('TAX_DOCUMENT_PREPARATION_SNAPSHOT_MISMATCH', 'Tax candidate does not match locked preparation snapshot', 409);
  }
  if (Number(preparation.finalSnapshot?.source?.saleId) !== Number(preparation.sourceId)) {
    fail('TAX_DOCUMENT_PREPARATION_SOURCE_MISMATCH', 'Locked preparation source sale does not match persistence authority', 409);
  }
};

const assertEligibleSaleSource = async ({ document, branchId }, tx) => {
  const candidate = document.candidate;
  if (candidate?.sourceType === 'DOCUMENT_PREPARATION') {
    await assertDocumentPreparationSource({ candidate, branchId }, tx);
    return;
  }
  if (candidate?.sourceType === 'CONSOLIDATED_DELIVERY') {
    const source = await tx.combinedBillingDocument.findFirst({
      where: { id: Number(candidate.sourceId), branchId: Number(branchId), status: 'ISSUED' },
      select: { id: true, documentLines: { where: { status: 'DOCUMENTED' }, select: { id: true } } },
    });
    if (!source || !source.documentLines.length) fail('TAX_SOURCE_CONSOLIDATED_DELIVERY_NOT_FOUND', 'Consolidated delivery source is not ready', 404);
    return;
  }
  if (!candidate || candidate.sourceType !== 'SALE') {
    fail('TAX_OUTPUT_ISSUANCE_SOURCE_UNSUPPORTED', 'Only a paid sale, locked document preparation, or consolidated delivery candidate can issue an output tax invoice', 409);
  }
  const saleId = Number(candidate.sourceId);
  const sale = await tx.sale.findFirst({
    where: { id: saleId, branchId: Number(branchId) },
    select: { id: true, status: true, statusPayment: true },
  });
  if (!sale) fail('TAX_SOURCE_SALE_NOT_FOUND', 'Sale not found', 404);

  const preparation = await tx.saleDocumentPreparation.findUnique({
    where: {
      branchId_sourceType_sourceId: {
        branchId: Number(branchId),
        sourceType: 'SALE',
        sourceId: String(saleId),
      },
    },
    select: { id: true, status: true },
  });
  if (preparation?.status === 'LOCKED') {
    const preparationCandidate = await tx.taxCandidate.findFirst({
      where: {
        branchId: Number(branchId),
        sourceType: 'DOCUMENT_PREPARATION',
        sourceId: { startsWith: `${preparation.id}:` },
      },
      select: { id: true },
    });
    if (preparationCandidate) {
      fail(
        'TAX_SOURCE_SALE_PREPARATION_AUTHORITY_ACTIVE',
        'Sale tax issuance moved to the locked document preparation after tax projection',
        409,
      );
    }
  }

  // Once any Sale line becomes part of a live consolidated Delivery Note,
  // future tax issuance authority moves away from the original Sale candidate.
  // Already-issued Sale tax documents replay before this guard, preserving
  // immutable legal history while preventing a second issuance path.
  const consolidatedSource = await tx.consolidatedDeliveryLine.findFirst({
    where: {
      branchId: Number(branchId),
      sourceSaleId: saleId,
      status: 'DOCUMENTED',
      combinedBilling: { is: { status: { not: 'CANCELLED' } } },
    },
    select: { combinedBillingId: true },
  });
  if (consolidatedSource) {
    fail(
      'TAX_SOURCE_SALE_ALREADY_CONSOLIDATED',
      'Sale tax issuance moved to the consolidated delivery document after consolidation',
      409,
    );
  }

  assertSaleTaxDocumentEligibility(sale);
};

const issueOutputTaxDocument = async ({ branchId, taxDocumentId, taxInvoiceKind, recipient, actorEmployeeId }) => {
  const normalizedBranchId = Number(branchId);
  const normalizedDocumentId = Number(taxDocumentId);
  if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
    fail('TAX_BRANCH_REQUIRED', 'branchId must be a positive integer');
  }
  if (!Number.isInteger(normalizedDocumentId) || normalizedDocumentId <= 0) {
    fail('TAX_DOCUMENT_ID_REQUIRED', 'taxDocumentId must be a positive integer');
  }
  const kind = normalizeKind(taxInvoiceKind);
  let recipientSnapshot = null;

  return prisma.$transaction(async (tx) => {
    const document = await documentRepository.findDetailById({
      branchId: normalizedBranchId,
      taxDocumentId: normalizedDocumentId,
    }, tx, { forUpdate: true });
    if (!document) fail('TAX_DOCUMENT_NOT_FOUND', 'Tax document not found', 404);

    if (document.issuerProfileId) {
      if (document.taxInvoiceKind !== kind) {
        fail('TAX_DOCUMENT_ALREADY_ISSUED', 'Tax document was already issued with a different invoice kind', 409);
      }
      const presentationSnapshot = await ensureStatutoryTaxPresentationSnapshot({
        tx,
        branchId: normalizedBranchId,
        taxDocument: document,
      });
      const outputVat = await outputVatRecordService.recordIssuedDocument({
        tx,
        branchId: normalizedBranchId,
        document,
        ledgerType: 'OUTPUT_VAT',
      });
      return Object.freeze({ replayed: true, document, outputVatRecord: outputVat.record, presentationSnapshot });
    }
    if (document.status !== 'DRAFT' || document.documentType !== 'OUTPUT_TAX_INVOICE') {
      fail('TAX_DOCUMENT_ISSUANCE_FORBIDDEN', 'Only a draft output tax document may be issued', 409);
    }

    if (document.candidate?.sourceType === 'DOCUMENT_PREPARATION') {
      const requiredKind = String(document.snapshot?.requiredTaxInvoiceKind || '').toUpperCase();
      if (!requiredKind || requiredKind !== kind) {
        fail(
          'TAX_DOCUMENT_PREPARATION_KIND_MISMATCH',
          `This document preparation portion must issue as ${requiredKind || 'its projected tax invoice kind'}`,
          409,
        );
      }
    }

    if (kind === 'FULL') {
      recipientSnapshot = normalizeRecipient(recipient || document.snapshot?.recipient);
    } else {
      const sourceRecipient = document.snapshot?.recipient || {};
      recipientSnapshot = {
        legalName: String(sourceRecipient.legalName || document.snapshot?.counterpartyName || '').trim() || null,
        taxId: String(sourceRecipient.taxId || document.counterpartyTaxId || '').replace(/[^0-9]/g, '') || null,
        registeredAddress: String(sourceRecipient.registeredAddress || '').trim() || null,
        branchCode: String(sourceRecipient.branchCode || '00000'),
        isHeadOffice: Boolean(sourceRecipient.isHeadOffice),
      };
    }

    await assertEligibleSaleSource({ document, branchId: normalizedBranchId }, tx);
    const profile = await selectActiveIssuerProfileForUpdate({ branchId: normalizedBranchId }, tx);
    const allocation = await allocateSequence({ profile, taxInvoiceKind: kind }, tx);

    const issuerSnapshot = {
      legalName: profile.legalName,
      taxId: profile.taxId,
      registeredAddress: profile.registeredAddress,
      branchCode: profile.branchCode,
      isHeadOffice: profile.isHeadOffice,
      prefix: kind === 'SHORT' ? profile.shortTaxInvoicePrefix : profile.fullTaxInvoicePrefix,
      taxInvoiceKind: kind,
      issuedSequence: allocation.issuedSequence,
      issuedDocumentNumber: allocation.issuedDocumentNumber,
    };

    const issued = await documentRepository.issueOutputTaxDocument({
      branchId: normalizedBranchId,
      taxDocumentId: normalizedDocumentId,
      issuerProfileId: profile.id,
      taxInvoiceKind: kind,
      issuedDocumentNumber: allocation.issuedDocumentNumber,
      issuedSequence: allocation.issuedSequence,
      issuerSnapshot,
      recipientSnapshot,
      counterpartyTaxId: recipientSnapshot?.taxId || document.counterpartyTaxId || null,
    }, tx);
    if (!issued) fail('TAX_DOCUMENT_ISSUANCE_CONFLICT', 'Tax document changed during issuance', 409);

    await documentRepository.appendLifecycleEvent({
      taxDocumentId: normalizedDocumentId,
      fromStatus: 'DRAFT',
      toStatus: 'REGISTERED',
      reason: 'Output tax invoice issued with an atomic issuer sequence',
      actorEmployeeId: actorEmployeeId || null,
      metadata: {
        branchId: normalizedBranchId,
        issuerProfileId: profile.id,
        taxInvoiceKind: kind,
        issuedSequence: allocation.issuedSequence,
        issuedDocumentNumber: allocation.issuedDocumentNumber,
      },
    }, tx);

    // Freeze presentation in the same issuance transaction as the legal
    // TaxDocument authority, so later store setting changes cannot rewrite history.
    const presentationSnapshot = await ensureStatutoryTaxPresentationSnapshot({
      tx,
      branchId: normalizedBranchId,
      taxDocument: issued,
    });

    const outputVat = await outputVatRecordService.recordIssuedDocument({
      tx,
      branchId: normalizedBranchId,
      document: issued,
      ledgerType: 'OUTPUT_VAT',
    });

    return Object.freeze({ replayed: false, document: issued, outputVatRecord: outputVat.record, presentationSnapshot });
  });
};

module.exports = Object.freeze({ issueOutputTaxDocument });
