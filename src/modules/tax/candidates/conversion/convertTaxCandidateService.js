'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { mapCandidateToTaxDocumentDraft } = require('../mapping/mapCandidateToTaxDocument');
const candidateRepository = require('../repository/taxCandidateRepository');
const documentRepository = require('../../documents/repository/taxDocumentRepository');
const {
  assertPeriodAllowsCreate,
} = require('../../outputTax/period/guard/outputTaxPeriodGuard');

const numberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const positiveInteger = (value, code, fieldName) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), {
      code,
      statusCode: 400,
    });
  }
  return number;
};

const convertTaxCandidate = async ({ branchId, candidateId, documentType, actorEmployeeId }) => {
  const normalizedBranchId = positiveInteger(branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const normalizedCandidateId = positiveInteger(candidateId, 'TAX_CANDIDATE_ID_REQUIRED', 'candidateId');

  return prisma.$transaction(async (tx) => {
    const candidate = await candidateRepository.findByIdForUpdate({
      branchId: normalizedBranchId,
      candidateId: normalizedCandidateId,
    }, tx);

    if (!candidate) {
      throw Object.assign(new Error('Tax candidate not found'), {
        code: 'TAX_CANDIDATE_NOT_FOUND',
        statusCode: 404,
      });
    }

    const existingDocument = await documentRepository.findByCandidateId(candidate.id, tx);
    if (existingDocument) {
      return Object.freeze({ replayed: true, candidate, document: existingDocument });
    }

    await assertPeriodAllowsCreate({
      branchId: normalizedBranchId,
      occurredAt: candidate.occurredAt,
    }, tx);

    const snapshot = candidate.snapshot || {};
    const mapped = mapCandidateToTaxDocumentDraft({
      candidate,
      documentNumber: candidate.sourceDocumentNo || `${candidate.sourceType}-${candidate.sourceId}`,
      issuerTaxId: snapshot.issuerTaxId || snapshot.counterpartyTaxId,
      documentType,
    });

    const identityConflict = await documentRepository.findByIdentityKey(mapped.identityKey, tx);
    if (identityConflict) {
      throw Object.assign(new Error('Tax document identity already exists'), {
        code: 'TAX_DOCUMENT_IDENTITY_CONFLICT',
        details: { identityKey: mapped.identityKey, taxDocumentId: identityConflict.id },
      });
    }

    await candidateRepository.updateMapped({
      id: candidate.id,
      mappedDocumentType: mapped.documentType,
    }, tx);

    const document = await documentRepository.create({
      branchId: candidate.branchId,
      candidateId: candidate.id,
      documentType: mapped.documentType,
      documentNumber: mapped.documentNumber,
      counterpartyTaxId: mapped.issuerTaxId,
      identityKey: mapped.identityKey,
      status: mapped.status,
      issuedAt: snapshot.issuedAt || null,
      occurredAt: candidate.occurredAt,
      currency: snapshot.currency || 'THB',
      subtotalAmount: numberOrZero(snapshot.subtotalAmount),
      taxAmount: numberOrZero(snapshot.taxAmount),
      totalAmount: numberOrZero(snapshot.totalAmount),
      snapshot,
    }, tx);

    await documentRepository.appendLifecycleEvent({
      taxDocumentId: document.id,
      fromStatus: null,
      toStatus: 'DRAFT',
      reason: 'Created from registered business document candidate',
      actorEmployeeId: actorEmployeeId || null,
      metadata: {
        registrationKey: candidate.registrationKey,
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
      },
    }, tx);

    const convertedCandidate = await candidateRepository.updateConverted(candidate.id, tx);
    return Object.freeze({ replayed: false, candidate: convertedCandidate, document });
  });
};

module.exports = Object.freeze({ convertTaxCandidate });
