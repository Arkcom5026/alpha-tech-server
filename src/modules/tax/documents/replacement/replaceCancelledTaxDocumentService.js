'use strict';

const { prisma } = require('../../../../../lib/prisma');
const documentRepository = require('../repository/taxDocumentRepository');

const normalizeText = (value) => String(value || '').trim();

const replaceCancelledTaxDocument = async ({
  branchId,
  taxDocumentId,
  replacementDocumentNumber,
  replacementOccurredAt = new Date(),
  actorEmployeeId,
  reason,
}) => {
  const normalizedBranchId = Number(branchId);
  const normalizedDocumentId = Number(taxDocumentId);
  const normalizedReplacementNumber = normalizeText(replacementDocumentNumber);
  const normalizedActorEmployeeId = actorEmployeeId == null ? null : Number(actorEmployeeId);
  const normalizedOccurredAt = new Date(replacementOccurredAt);
  const normalizedReason = normalizeText(reason);

  if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
    throw Object.assign(new Error('branchId must be a positive integer'), {
      code: 'TAX_BRANCH_REQUIRED',
      statusCode: 400,
    });
  }
  if (!Number.isInteger(normalizedDocumentId) || normalizedDocumentId <= 0) {
    throw Object.assign(new Error('taxDocumentId must be a positive integer'), {
      code: 'TAX_DOCUMENT_ID_REQUIRED',
      statusCode: 400,
    });
  }
  if (!normalizedReplacementNumber) {
    throw Object.assign(new Error('replacementDocumentNumber is required'), {
      code: 'TAX_REPLACEMENT_DOCUMENT_NUMBER_REQUIRED',
      statusCode: 400,
    });
  }
  if (!normalizedReason) {
    throw Object.assign(new Error('reason is required for tax document replacement'), {
      code: 'TAX_DOCUMENT_REPLACEMENT_REASON_REQUIRED',
      statusCode: 400,
    });
  }
  if (Number.isNaN(normalizedOccurredAt.getTime())) {
    throw Object.assign(new Error('replacementOccurredAt must be a valid date'), {
      code: 'TAX_REPLACEMENT_OCCURRED_AT_INVALID',
      statusCode: 400,
    });
  }
  if (normalizedActorEmployeeId != null && (!Number.isInteger(normalizedActorEmployeeId) || normalizedActorEmployeeId <= 0)) {
    throw Object.assign(new Error('actorEmployeeId must be a positive integer'), {
      code: 'TAX_ACTOR_EMPLOYEE_ID_INVALID',
      statusCode: 400,
    });
  }

  return prisma.$transaction(async (tx) => {
    const cancelled = await documentRepository.findByIdForUpdate({
      branchId: normalizedBranchId,
      taxDocumentId: normalizedDocumentId,
    }, tx);

    if (!cancelled) {
      throw Object.assign(new Error('Tax document not found'), {
        code: 'TAX_DOCUMENT_NOT_FOUND',
        statusCode: 404,
      });
    }

    const cancelledStatus = String(cancelled.status || '').trim().toUpperCase();
    if (cancelledStatus !== 'CANCELLED') {
      throw Object.assign(new Error(`Tax document in status ${cancelledStatus || 'UNKNOWN'} cannot be replaced`), {
        code: 'TAX_DOCUMENT_REPLACEMENT_FORBIDDEN',
        statusCode: 409,
      });
    }

    const replacementIdentityKey = `REPLACEMENT:${cancelled.identityKey}:${normalizedReplacementNumber}`;
    const existingReplacement = await documentRepository.findByIdentityKey(replacementIdentityKey, tx);
    if (existingReplacement) {
      return Object.freeze({ replayed: true, replacedDocument: cancelled, replacementDocument: existingReplacement });
    }

    const duplicateNumber = await documentRepository.findByDocumentNumber({
      branchId: normalizedBranchId,
      documentType: cancelled.documentType,
      documentNumber: normalizedReplacementNumber,
    }, tx);
    if (duplicateNumber) {
      throw Object.assign(new Error('Replacement tax document number already exists'), {
        code: 'TAX_REPLACEMENT_DOCUMENT_NUMBER_DUPLICATE',
        statusCode: 409,
      });
    }

    const replacementSnapshot = {
      ...(cancelled.snapshot || {}),
      replacementOf: {
        taxDocumentId: cancelled.id,
        documentNumber: cancelled.documentNumber,
        identityKey: cancelled.identityKey,
        reason: normalizedReason,
        replacedAt: normalizedOccurredAt.toISOString(),
      },
    };

    const replacement = await documentRepository.create({
      branchId: normalizedBranchId,
      candidateId: null,
      documentType: cancelled.documentType,
      documentNumber: normalizedReplacementNumber,
      counterpartyTaxId: cancelled.counterpartyTaxId || null,
      identityKey: replacementIdentityKey,
      status: 'DRAFT',
      issuedAt: null,
      occurredAt: normalizedOccurredAt,
      currency: cancelled.currency || 'THB',
      subtotalAmount: cancelled.subtotalAmount || 0,
      taxAmount: cancelled.taxAmount || 0,
      totalAmount: cancelled.totalAmount || 0,
      snapshot: replacementSnapshot,
    }, tx);

    await documentRepository.appendLifecycleEvent({
      taxDocumentId: replacement.id,
      fromStatus: null,
      toStatus: 'DRAFT',
      reason: normalizedReason,
      actorEmployeeId: normalizedActorEmployeeId,
      metadata: {
        branchId: normalizedBranchId,
        replacementOfTaxDocumentId: cancelled.id,
        replacementOfDocumentNumber: cancelled.documentNumber || null,
      },
    }, tx);

    await documentRepository.appendLifecycleEvent({
      taxDocumentId: cancelled.id,
      fromStatus: 'CANCELLED',
      toStatus: 'CANCELLED',
      reason: normalizedReason,
      actorEmployeeId: normalizedActorEmployeeId,
      metadata: {
        branchId: normalizedBranchId,
        replacementTaxDocumentId: replacement.id,
        replacementDocumentNumber: normalizedReplacementNumber,
      },
    }, tx);

    return Object.freeze({ replayed: false, replacedDocument: cancelled, replacementDocument: replacement });
  });
};

module.exports = Object.freeze({ replaceCancelledTaxDocument });
