'use strict';

const { prisma } = require('../../../../../lib/prisma');
const documentRepository = require('../repository/taxDocumentRepository');

const normalizeText = (value) => String(value || '').trim();

const issueTaxDocument = async ({
  branchId,
  taxDocumentId,
  documentNumber,
  issuedAt = new Date(),
  actorEmployeeId,
  reason,
}) => {
  const normalizedBranchId = Number(branchId);
  const normalizedDocumentId = Number(taxDocumentId);
  const normalizedDocumentNumber = normalizeText(documentNumber);
  const normalizedActorEmployeeId = actorEmployeeId == null ? null : Number(actorEmployeeId);
  const normalizedIssuedAt = new Date(issuedAt);

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
  if (!normalizedDocumentNumber) {
    throw Object.assign(new Error('documentNumber is required'), {
      code: 'TAX_DOCUMENT_NUMBER_REQUIRED',
      statusCode: 400,
    });
  }
  if (Number.isNaN(normalizedIssuedAt.getTime())) {
    throw Object.assign(new Error('issuedAt must be a valid date'), {
      code: 'TAX_ISSUED_AT_INVALID',
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
    const current = await documentRepository.findByIdForUpdate({
      branchId: normalizedBranchId,
      taxDocumentId: normalizedDocumentId,
    }, tx);

    if (!current) {
      throw Object.assign(new Error('Tax document not found'), {
        code: 'TAX_DOCUMENT_NOT_FOUND',
        statusCode: 404,
      });
    }

    const currentStatus = String(current.status || '').trim().toUpperCase();
    if (currentStatus === 'ISSUED') {
      if (String(current.documentNumber || '').trim() !== normalizedDocumentNumber) {
        throw Object.assign(new Error('Issued tax document number does not match the requested number'), {
          code: 'TAX_DOCUMENT_ISSUE_IDEMPOTENCY_CONFLICT',
          statusCode: 409,
        });
      }
      return Object.freeze({ replayed: true, document: current });
    }

    if (!['DRAFT', 'APPROVED'].includes(currentStatus)) {
      throw Object.assign(new Error(`Tax document in status ${currentStatus || 'UNKNOWN'} cannot be issued`), {
        code: 'TAX_DOCUMENT_ISSUE_FORBIDDEN',
        statusCode: 409,
      });
    }

    const duplicate = await documentRepository.findByDocumentNumber({
      branchId: normalizedBranchId,
      documentType: current.documentType,
      documentNumber: normalizedDocumentNumber,
    }, tx);

    if (duplicate && Number(duplicate.id) !== normalizedDocumentId) {
      throw Object.assign(new Error('Tax document number already exists'), {
        code: 'TAX_DOCUMENT_NUMBER_DUPLICATE',
        statusCode: 409,
      });
    }

    const issued = await documentRepository.issue({
      branchId: normalizedBranchId,
      taxDocumentId: normalizedDocumentId,
      expectedStatus: currentStatus,
      documentNumber: normalizedDocumentNumber,
      issuedAt: normalizedIssuedAt,
    }, tx);

    if (!issued) {
      throw Object.assign(new Error('Tax document changed during issue'), {
        code: 'TAX_DOCUMENT_ISSUE_CONFLICT',
        statusCode: 409,
      });
    }

    await documentRepository.appendLifecycleEvent({
      taxDocumentId: normalizedDocumentId,
      fromStatus: currentStatus,
      toStatus: 'ISSUED',
      reason: normalizeText(reason) || null,
      actorEmployeeId: normalizedActorEmployeeId,
      metadata: {
        branchId: normalizedBranchId,
        documentNumber: normalizedDocumentNumber,
        issuedAt: normalizedIssuedAt.toISOString(),
      },
    }, tx);

    return Object.freeze({ replayed: false, document: issued });
  });
};

module.exports = Object.freeze({ issueTaxDocument });
