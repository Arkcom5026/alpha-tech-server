'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { assertTaxDocumentTransition } = require('./taxDocumentLifecycle');
const documentRepository = require('../repository/taxDocumentRepository');

const transitionTaxDocument = async ({ branchId, taxDocumentId, targetStatus, reason, actorEmployeeId }) => {
  const normalizedBranchId = Number(branchId);
  const normalizedDocumentId = Number(taxDocumentId);
  const normalizedTarget = String(targetStatus || '').trim().toUpperCase();

  if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
    throw Object.assign(new Error('branchId must be a positive integer'), { code: 'TAX_BRANCH_REQUIRED', statusCode: 400 });
  }
  if (!Number.isInteger(normalizedDocumentId) || normalizedDocumentId <= 0) {
    throw Object.assign(new Error('taxDocumentId must be a positive integer'), { code: 'TAX_DOCUMENT_ID_REQUIRED', statusCode: 400 });
  }

  return prisma.$transaction(async (tx) => {
    const current = await documentRepository.findByIdForUpdate({
      branchId: normalizedBranchId,
      taxDocumentId: normalizedDocumentId,
    }, tx);

    if (!current) {
      throw Object.assign(new Error('Tax document not found'), { code: 'TAX_DOCUMENT_NOT_FOUND', statusCode: 404 });
    }

    const decision = assertTaxDocumentTransition({ currentStatus: current.status, targetStatus: normalizedTarget });
    if (decision.replayed) return Object.freeze({ replayed: true, document: current });

    const updated = await documentRepository.updateStatus({
      branchId: normalizedBranchId,
      taxDocumentId: normalizedDocumentId,
      expectedStatus: decision.currentStatus,
      targetStatus: decision.targetStatus,
    }, tx);

    if (!updated) {
      throw Object.assign(new Error('Tax document changed during transition'), {
        code: 'TAX_DOCUMENT_LIFECYCLE_CONFLICT',
        statusCode: 409,
      });
    }

    await documentRepository.appendLifecycleEvent({
      taxDocumentId: normalizedDocumentId,
      fromStatus: decision.currentStatus,
      toStatus: decision.targetStatus,
      reason: String(reason || '').trim() || null,
      actorEmployeeId: actorEmployeeId || null,
      metadata: { branchId: normalizedBranchId },
    }, tx);

    return Object.freeze({ replayed: false, document: updated });
  });
};

module.exports = Object.freeze({ transitionTaxDocument });
