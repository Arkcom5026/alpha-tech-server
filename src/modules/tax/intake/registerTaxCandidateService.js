'use strict';

const { prisma } = require('../../../../lib/prisma');
const { buildTaxCandidateRegistration } = require('../candidates/contracts/taxCandidateContract');
const { mapCandidateToTaxDocument } = require('../candidates/mapping/mapCandidateToTaxDocument');
const { buildTaxDocumentIdentity } = require('../documents/contracts/taxDocumentContract');
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
      return Object.freeze({
        replayed: true,
        candidate: existingCandidate,
        document: existingDocument,
      });
    }

    const candidate = await candidateRepository.create(registration, tx);
    const mapped = mapCandidateToTaxDocument(candidate);
    const snapshot = registration.snapshot || {};
    const documentNumber = mapped.documentNumber || registration.sourceDocumentNo || `${registration.sourceType}-${registration.sourceId}`;
    const identity = buildTaxDocumentIdentity({
      branchId: registration.branchId,
      documentType: mapped.documentType,
      documentNumber,
      issuerTaxId: mapped.issuerTaxId || snapshot.issuerTaxId || snapshot.counterpartyTaxId,
    });

    const existingDocument = await documentRepository.findByIdentityKey(identity.identityKey, tx);
    if (existingDocument) {
      throw Object.assign(new Error('Tax document identity already exists'), {
        code: 'TAX_DOCUMENT_IDENTITY_CONFLICT',
        details: { identityKey: identity.identityKey, taxDocumentId: existingDocument.id },
      });
    }

    await candidateRepository.updateMapped({ id: candidate.id, mappedDocumentType: mapped.documentType }, tx);

    const document = await documentRepository.create({
      branchId: registration.branchId,
      candidateId: candidate.id,
      documentType: mapped.documentType,
      documentNumber: identity.documentNumber,
      counterpartyTaxId: identity.issuerTaxId,
      identityKey: identity.identityKey,
      status: 'DRAFT',
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

    return Object.freeze({
      replayed: false,
      candidate: convertedCandidate,
      document,
    });
  });
};

module.exports = Object.freeze({ registerTaxCandidate });
