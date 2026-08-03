'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');
const documentRepository = require('../repository/taxDocumentRepository');
const { assertSaleTaxDocumentEligibility } = require('../../sources/sale/saleTaxDocumentEligibilityPolicy');

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

const assertEligibleSaleSource = async ({ document, branchId }, tx) => {
  const candidate = document.candidate;
  if (!candidate || candidate.sourceType !== 'SALE') {
    fail('TAX_OUTPUT_ISSUANCE_SOURCE_UNSUPPORTED', 'Only a paid sale candidate can issue an output tax invoice', 409);
  }
  const sale = await tx.sale.findFirst({
    where: { id: Number(candidate.sourceId), branchId: Number(branchId) },
    select: { id: true, status: true, statusPayment: true },
  });
  if (!sale) fail('TAX_SOURCE_SALE_NOT_FOUND', 'Sale not found', 404);
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
  const recipientSnapshot = kind === 'FULL' ? normalizeRecipient(recipient) : null;

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
      return Object.freeze({ replayed: true, document });
    }
    if (document.status !== 'DRAFT' || document.documentType !== 'OUTPUT_TAX_INVOICE') {
      fail('TAX_DOCUMENT_ISSUANCE_FORBIDDEN', 'Only a draft output tax document may be issued', 409);
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

    return Object.freeze({ replayed: false, document: issued });
  });
};

module.exports = Object.freeze({ issueOutputTaxDocument });
