'use strict';

const { prisma } = require('../../../../../lib/prisma');
const documentRepository = require('../repository/taxDocumentRepository');
const { assertPeriodAllowsCancel } = require('../../outputTax/period/guard/outputTaxPeriodGuard');

const normalizeText = (value) => String(value || '').trim();

const cancelTaxDocument = async ({
  branchId,
  taxDocumentId,
  reason,
  actorEmployeeId,
  cancelledAt = new Date(),
}) => {
  const normalizedBranchId = Number(branchId);
  const normalizedDocumentId = Number(taxDocumentId);
  const normalizedActorEmployeeId = actorEmployeeId == null ? null : Number(actorEmployeeId);
  const normalizedReason = normalizeText(reason);
  const normalizedCancelledAt = new Date(cancelledAt);

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
  if (!normalizedReason) {
    throw Object.assign(new Error('reason is required for tax document cancellation'), {
      code: 'TAX_DOCUMENT_CANCELLATION_REASON_REQUIRED',
      statusCode: 400,
    });
  }
  if (Number.isNaN(normalizedCancelledAt.getTime())) {
    throw Object.assign(new Error('cancelledAt must be a valid date'), {
      code: 'TAX_CANCELLED_AT_INVALID',
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
    if (currentStatus === 'CANCELLED') {
      return Object.freeze({ replayed: true, document: current });
    }
    if (currentStatus !== 'ISSUED') {
      throw Object.assign(new Error(`Tax document in status ${currentStatus || 'UNKNOWN'} cannot be cancelled`), {
        code: 'TAX_DOCUMENT_CANCELLATION_FORBIDDEN',
        statusCode: 409,
      });
    }

    await assertPeriodAllowsCancel({
      branchId: normalizedBranchId,
      occurredAt: current.occurredAt || current.issuedAt || normalizedCancelledAt,
    }, tx);

    const cancelled = await documentRepository.updateStatus({
      branchId: normalizedBranchId,
      taxDocumentId: normalizedDocumentId,
      expectedStatus: 'ISSUED',
      targetStatus: 'CANCELLED',
    }, tx);

    if (!cancelled) {
      throw Object.assign(new Error('Tax document changed during cancellation'), {
        code: 'TAX_DOCUMENT_CANCELLATION_CONFLICT',
        statusCode: 409,
      });
    }

    await documentRepository.appendLifecycleEvent({
      taxDocumentId: normalizedDocumentId,
      fromStatus: 'ISSUED',
      toStatus: 'CANCELLED',
      reason: normalizedReason,
      actorEmployeeId: normalizedActorEmployeeId,
      metadata: {
        branchId: normalizedBranchId,
        documentNumber: current.documentNumber || null,
        cancelledAt: normalizedCancelledAt.toISOString(),
      },
    }, tx);

    return Object.freeze({ replayed: false, document: cancelled });
  });
};

module.exports = Object.freeze({ cancelTaxDocument });