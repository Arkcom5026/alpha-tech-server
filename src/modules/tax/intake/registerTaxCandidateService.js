'use strict';

const { prisma } = require('../../../../lib/prisma');
const { buildTaxCandidateRegistration } = require('../candidates/contracts/taxCandidateContract');
const { mapCandidateToTaxDocumentDraft } = require('../candidates/mapping/mapCandidateToTaxDocument');
const candidateRepository = require('../candidates/repository/taxCandidateRepository');
const documentRepository = require('../documents/repository/taxDocumentRepository');

const numberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const registerTaxCandidate = async (input) => {
  const registration = buildTaxCandidateRegistration(input);

  return prisma.$transaction(async (tx) => {
    const existingCandidate = await candidateRepository.findByRegistrationKey(registration.registrationKey, tx);
    if (existingCandidate) {
      const existingDocument = await documentRepository.findByCandidateId(existingCandidate.id, tx);
      return Object.freeze({ replayed: true, candidate: existingCandidate, document: existingDocument });
    }

    const candidate = await candidateRepository.create(registration, tx);
    const snapshot = registration.snapshot || {};
    const mapped = mapCandidateToTaxDocumentDraft({
      candidate,
      documentNumber: registration.sourceDocumentNo || `${registration.sourceType}-${registration.sourceId}`,
      issuerTaxId: snapshot.issuerTaxId || null,
      counterpartyTaxId: snapshot.counterpartyTaxId || null,
      documentType: input.documentType,
    });

    const existingDocument = await documentRepository.findByIdentityKey(mapped.identityKey, tx);
    if (existingDocument) {
      throw Object.assign(new Error('Tax document identity already exists'), {
        code: 'TAX_DOCUMENT_IDENTITY_CONFLICT',
        details: { identityKey: mapped.identityKey, taxDocumentId: existingDocument.id },
      });
    }

    await candidateRepository.updateMapped({ id: candidate.id, mappedDocumentType: mapped.documentType }, tx);

    const document = await documentRepository.create({
      branchId: registration.branchId,
      candidateId: candidate.id,
      documentType: mapped.documentType,
      documentNumber: mapped.documentNumber,
      counterpartyTaxId: mapped.counterpartyTaxId,
      identityKey: mapped.identityKey,
      status: mapped.status,
      issuedAt: snapshot.issuedAt || null,
      occurredAt: registration.occurredAt,
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
      actorEmployeeId: input.actorEmployeeId || null,
      metadata: {
        registrationKey: registration.registrationKey,
        sourceType: registration.sourceType,
        sourceId: registration.sourceId,
      },
    }, tx);

    const convertedCandidate = await candidateRepository.updateConverted(candidate.id, tx);
    return Object.freeze({ replayed: false, candidate: convertedCandidate, document });
  });
};

module.exports = Object.freeze({ registerTaxCandidate });
