'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');
const { buildTaxCandidateRegistration } = require('../../candidates/contracts/taxCandidateContract');
const { mapCandidateToTaxDocumentDraft } = require('../../candidates/mapping/mapCandidateToTaxDocument');
const candidateRepository = require('../../candidates/repository/taxCandidateRepository');
const documentRepository = require('../../documents/repository/taxDocumentRepository');

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const positiveInt = (value, code, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(code, `${field} must be a positive integer`);
  return parsed;
};

const portionSourceId = (preparationId, portion) => `${Number(preparationId)}:${portion}`;

const taxFactsByPortion = (snapshot, portion) => {
  const facts = Array.isArray(snapshot?.vatAllocation)
    ? snapshot.vatAllocation.find((entry) => entry?.portion === portion)
    : null;
  if (!facts) fail('DOCUMENT_PREPARATION_VAT_ALLOCATION_MISSING', `VAT allocation for ${portion} is missing`, 409);
  return facts;
};

const projectionByPortion = (snapshot, portion) => {
  const projection = Array.isArray(snapshot?.taxProjection)
    ? snapshot.taxProjection.find((entry) => entry?.portion === portion)
    : null;
  if (!projection) fail('DOCUMENT_PREPARATION_TAX_PROJECTION_MISSING', `Tax projection for ${portion} is missing`, 409);
  return projection;
};

const buildRecipient = (agency) => {
  if (!agency || typeof agency !== 'object') return null;
  return {
    legalName: agency.organizationName || null,
    taxId: agency.taxId || null,
    registeredAddress: agency.address || null,
    branchCode: '00000',
    isHeadOffice: true,
  };
};

const buildPortionSnapshot = ({ finalSnapshot, portion }) => {
  const projection = projectionByPortion(finalSnapshot, portion);
  const taxFacts = taxFactsByPortion(finalSnapshot, portion);
  const isInBudget = portion === 'IN_BUDGET';
  const recipient = isInBudget ? buildRecipient(finalSnapshot.agency) : null;
  const items = isInBudget
    ? finalSnapshot.lines
    : finalSnapshot.outOfBudgetService
      ? [finalSnapshot.outOfBudgetService]
      : [];

  if (!Array.isArray(items) || items.length === 0) {
    fail('DOCUMENT_PREPARATION_TAX_ITEMS_MISSING', `Tax items for ${portion} are missing`, 409);
  }

  return Object.freeze({
    preparationId: Number(finalSnapshot.preparationId),
    sourceSaleId: Number(finalSnapshot.source?.saleId || 0),
    sourceSaleCode: finalSnapshot.source?.saleCode || null,
    sourceDeliveryNoteNumber: finalSnapshot.source?.deliveryNoteNumber || null,
    portion,
    requiredTaxInvoiceKind: projection.taxInvoiceKind,
    counterpartyName: isInBudget ? finalSnapshot.agency?.organizationName || null : null,
    counterpartyTaxId: isInBudget ? finalSnapshot.agency?.taxId || null : null,
    recipient,
    subtotalAmount: Number(taxFacts.subtotalAmount || 0),
    taxAmount: Number(taxFacts.taxAmount || 0),
    totalAmount: Number(taxFacts.totalAmount || 0),
    vatRate: Number(finalSnapshot.source?.vatRate || 0),
    currency: 'THB',
    issuedAt: finalSnapshot.lockedAt,
    items,
    sourceSnapshotVersion: Number(finalSnapshot.schemaVersion || 1),
  });
};

const ensureCandidateDocument = async ({ tx, branchId, preparation, portion, actorEmployeeId }) => {
  const finalSnapshot = preparation.finalSnapshot;
  const sourceId = portionSourceId(preparation.id, portion);
  const sourceDocumentNo = [
    finalSnapshot.source?.deliveryNoteNumber || finalSnapshot.source?.saleCode || `SALE-${finalSnapshot.source?.saleId}`,
    portion === 'IN_BUDGET' ? 'BUDGET' : 'SERVICE',
  ].join('-');
  const snapshot = buildPortionSnapshot({ finalSnapshot, portion });
  const registration = buildTaxCandidateRegistration({
    branchId,
    sourceType: 'DOCUMENT_PREPARATION',
    sourceId,
    sourceDocumentNo,
    occurredAt: finalSnapshot.lockedAt,
    snapshot,
  });

  const existingCandidate = await candidateRepository.findByRegistrationKey(registration.registrationKey, tx);
  if (existingCandidate) {
    const existingDocument = await documentRepository.findByCandidateId(existingCandidate.id, tx);
    if (!existingDocument) {
      fail('DOCUMENT_PREPARATION_TAX_REPLAY_INCOMPLETE', 'Existing preparation tax candidate has no tax document', 409);
    }
    return Object.freeze({ replayed: true, portion, candidate: existingCandidate, document: existingDocument });
  }

  const candidate = await candidateRepository.create(registration, tx);
  const mapped = mapCandidateToTaxDocumentDraft({
    candidate,
    documentNumber: sourceDocumentNo,
    counterpartyTaxId: snapshot.counterpartyTaxId,
    documentType: 'OUTPUT_TAX_INVOICE',
  });
  await candidateRepository.updateMapped({ id: candidate.id, mappedDocumentType: mapped.documentType }, tx);

  const document = await documentRepository.create({
    branchId,
    candidateId: candidate.id,
    documentType: mapped.documentType,
    documentNumber: mapped.documentNumber,
    counterpartyTaxId: mapped.counterpartyTaxId,
    identityKey: mapped.identityKey,
    status: mapped.status,
    issuedAt: null,
    occurredAt: registration.occurredAt,
    currency: 'THB',
    subtotalAmount: snapshot.subtotalAmount,
    taxAmount: snapshot.taxAmount,
    totalAmount: snapshot.totalAmount,
    snapshot,
  }, tx);

  await documentRepository.appendLifecycleEvent({
    taxDocumentId: document.id,
    fromStatus: null,
    toStatus: 'DRAFT',
    reason: 'Created from locked sale document preparation',
    actorEmployeeId: actorEmployeeId || null,
    metadata: {
      preparationId: preparation.id,
      portion,
      requiredTaxInvoiceKind: snapshot.requiredTaxInvoiceKind,
      registrationKey: registration.registrationKey,
    },
  }, tx);
  const converted = await candidateRepository.updateConverted(candidate.id, tx);
  return Object.freeze({ replayed: false, portion, candidate: converted, document });
};

const registerDocumentPreparationTaxCandidates = async ({ branchId, saleId, actorEmployeeId }) => {
  const normalizedBranchId = positiveInt(branchId, 'DOCUMENT_PREPARATION_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleId = positiveInt(saleId, 'DOCUMENT_PREPARATION_SALE_REQUIRED', 'saleId');
  const normalizedActorId = actorEmployeeId == null
    ? null
    : positiveInt(actorEmployeeId, 'DOCUMENT_PREPARATION_ACTOR_INVALID', 'actorEmployeeId');

  return prisma.$transaction(async (tx) => {
    const preparation = await tx.saleDocumentPreparation.findUnique({
      where: {
        branchId_sourceType_sourceId: {
          branchId: normalizedBranchId,
          sourceType: 'SALE',
          sourceId: String(normalizedSaleId),
        },
      },
    });
    if (!preparation) fail('DOCUMENT_PREPARATION_NOT_FOUND', 'Document preparation not found', 404);
    if (preparation.status !== 'LOCKED' || !preparation.finalSnapshot) {
      fail('DOCUMENT_PREPARATION_NOT_LOCKED', 'Document preparation must be locked before tax projection', 409);
    }

    const finalSnapshot = preparation.finalSnapshot;
    if (Number(finalSnapshot.source?.saleId) !== normalizedSaleId) {
      fail('DOCUMENT_PREPARATION_SOURCE_SNAPSHOT_MISMATCH', 'Locked source snapshot does not match sale', 409);
    }

    const issuedSaleTax = await tx.taxCandidate.findFirst({
      where: {
        branchId: normalizedBranchId,
        sourceType: 'SALE',
        sourceId: String(normalizedSaleId),
        document: {
          is: {
            documentType: 'OUTPUT_TAX_INVOICE',
            issuedDocumentNumber: { not: null },
            issuerProfileId: { not: null },
          },
        },
      },
      select: { document: { select: { issuedDocumentNumber: true } } },
    });
    if (issuedSaleTax) {
      fail(
        'DOCUMENT_PREPARATION_SOURCE_TAX_ALREADY_ISSUED',
        `Source sale already has an issued tax invoice (${issuedSaleTax.document?.issuedDocumentNumber || normalizedSaleId})`,
        409,
      );
    }

    const portions = ['IN_BUDGET'];
    if (Number(finalSnapshot.totals?.outOfBudgetTotal || 0) > 0) portions.push('OUT_OF_BUDGET');

    const results = [];
    for (const portion of portions) {
      results.push(await ensureCandidateDocument({
        tx,
        branchId: normalizedBranchId,
        preparation,
        portion,
        actorEmployeeId: normalizedActorId,
      }));
    }

    const totalAmount = results.reduce((sum, result) => sum + Number(result.document.totalAmount || 0), 0);
    const taxAmount = results.reduce((sum, result) => sum + Number(result.document.taxAmount || 0), 0);
    if (Number(totalAmount.toFixed(2)) !== Number(finalSnapshot.totals.sourceTotal || 0)
      || Number(taxAmount.toFixed(2)) !== Number(finalSnapshot.source.taxAmount || 0)) {
      fail('DOCUMENT_PREPARATION_TAX_RECONCILIATION_FAILED', 'Preparation tax documents do not reconcile to locked source totals', 409);
    }

    return Object.freeze({
      preparationId: preparation.id,
      sourceSaleId: normalizedSaleId,
      results: Object.freeze(results),
      totals: Object.freeze({
        sourceTotal: Number(finalSnapshot.totals.sourceTotal || 0),
        projectedTotal: Number(totalAmount.toFixed(2)),
        sourceTaxAmount: Number(finalSnapshot.source.taxAmount || 0),
        projectedTaxAmount: Number(taxAmount.toFixed(2)),
      }),
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
};

module.exports = Object.freeze({
  buildPortionSnapshot,
  portionSourceId,
  registerDocumentPreparationTaxCandidates,
});
