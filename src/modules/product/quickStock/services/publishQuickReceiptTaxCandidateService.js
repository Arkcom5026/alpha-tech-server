'use strict';

const taxModule = require('../../../tax');

const publishQuickReceiptTaxCandidate = async ({ receipt, branchId, employeeId }) => {
  const receiptId = Number(receipt?.id);
  const status = String(receipt?.status || '').trim().toUpperCase();
  const taxMode = String(receipt?.taxDocumentMode || 'NOT_RECEIVED').trim().toUpperCase();

  if (!Number.isInteger(receiptId) || receiptId <= 0) {
    return Object.freeze({ status: 'SKIPPED', reason: 'QUICK_RECEIPT_ID_MISSING' });
  }
  if (status !== 'COMPLETED') {
    return Object.freeze({ status: 'SKIPPED', reason: 'QUICK_RECEIPT_NOT_COMPLETED', receiptId });
  }
  if (taxMode !== 'RECEIVED') {
    return Object.freeze({
      status: 'SKIPPED',
      reason: 'TAX_DOCUMENT_NOT_RECEIVED',
      receiptId,
      taxDocumentMode: taxMode,
    });
  }

  try {
    const result = await taxModule.intake.registerPurchaseReceiptCandidate({
      branchId: Number(branchId),
      receipt,
      actorEmployeeId: Number(employeeId) || null,
    });
    return Object.freeze({
      status: result?.replayed ? 'REPLAYED' : 'REGISTERED',
      receiptId,
      replayed: Boolean(result?.replayed),
      candidateId: result?.candidate?.id || null,
      taxDocumentId: result?.document?.id || null,
    });
  } catch (error) {
    console.error('[quick-receipt.tax-intake] publication failed', {
      branchId: Number(branchId),
      receiptId,
      code: error?.code,
      message: error?.message,
    });
    return Object.freeze({
      status: 'PENDING_RETRY',
      receiptId,
      code: error?.code || 'TAX_INTAKE_PUBLICATION_FAILED',
    });
  }
};

module.exports = Object.freeze({ publishQuickReceiptTaxCandidate });
