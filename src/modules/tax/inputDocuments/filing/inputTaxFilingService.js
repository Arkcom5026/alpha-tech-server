'use strict';

const repository = require('./inputTaxFilingRepository');
const { createFilingItemProjection } = require('./inputTaxFilingContract');

const positiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), {
      code: 'INPUT_TAX_FILING_INPUT_INVALID',
      statusCode: 400,
      details: { fieldName },
    });
  }
  return parsed;
};

const decimal = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw Object.assign(new Error(`${fieldName} must be a non-negative amount`), {
      code: 'INPUT_TAX_FILING_AMOUNT_INVALID',
      statusCode: 400,
      details: { fieldName },
    });
  }
  return parsed.toFixed(2);
};

const PERIOD_MUTATION_BLOCKED_STATUSES = new Set(['CLOSED', 'LOCKED', 'SUBMITTED']);

const assertBatchPeriodMutable = async ({ batchId }, tx) => {
  const authority = await repository.findBatchPeriodAuthority({ batchId }, tx);
  if (!authority) {
    throw Object.assign(new Error('Input tax filing batch was not found'), {
      code: 'INPUT_TAX_FILING_BATCH_NOT_FOUND',
      statusCode: 404,
    });
  }
  if (PERIOD_MUTATION_BLOCKED_STATUSES.has(authority.taxPeriodStatus)) {
    throw Object.assign(new Error('Input tax filing mutation is blocked while its period is closed'), {
      code: 'INPUT_TAX_PERIOD_MUTATION_BLOCKED',
      statusCode: 409,
      details: {
        batchId: Number(authority.batchId),
        taxPeriodId: authority.taxPeriodId,
        taxPeriodStatus: authority.taxPeriodStatus,
      },
    });
  }
  return authority;
};

const mapRow = (row) => createFilingItemProjection({
  id: Number(row.id),
  batchId: Number(row.batchId),
  taxDocumentId: Number(row.taxDocumentId),
  legacyPurchaseOrderReceiptId: row.purchaseOrderReceiptId == null
    ? null
    : Number(row.purchaseOrderReceiptId),
  status: row.status,
  claimedSubtotalAmount: row.claimedSubtotalAmount,
  claimedVatAmount: row.claimedVatAmount,
  claimedTotalAmount: row.claimedTotalAmount,
  eligibilitySnapshot: row.eligibilitySnapshot,
  documentSnapshot: row.documentSnapshot,
  selectedAt: row.selectedAt,
  filedAt: row.filedAt,
  version: Number(row.version),
});

const selectTaxDocumentForFiling = async ({
  batchId,
  taxDocumentId,
  reconciliation,
  eligibility,
  document,
  selectedAt = new Date(),
}, tx) => {
  const normalizedBatchId = positiveInt(batchId, 'batchId');
  const normalizedTaxDocumentId = positiveInt(taxDocumentId, 'taxDocumentId');

  await assertBatchPeriodMutable({ batchId: normalizedBatchId }, tx);

  if (!reconciliation?.canApprove) {
    throw Object.assign(new Error('Input tax document must be reconciled before filing selection'), {
      code: 'INPUT_TAX_FILING_RECONCILIATION_REQUIRED',
      statusCode: 409,
      details: { reconciliation },
    });
  }
  if (!eligibility?.canSelectForFiling) {
    throw Object.assign(new Error('Input tax document is not eligible for filing selection'), {
      code: 'INPUT_TAX_FILING_ELIGIBILITY_REQUIRED',
      statusCode: 409,
      details: { eligibility },
    });
  }

  const activeItems = await repository.findActiveByDocument({
    taxDocumentId: normalizedTaxDocumentId,
  }, tx);
  const conflictingItem = activeItems.find((item) => Number(item.batchId) !== normalizedBatchId);
  if (conflictingItem) {
    throw Object.assign(new Error('Input tax document is already selected or filed in another batch'), {
      code: 'INPUT_TAX_DOCUMENT_ALREADY_IN_FILING',
      statusCode: 409,
      details: {
        taxDocumentId: normalizedTaxDocumentId,
        existingBatchId: Number(conflictingItem.batchId),
        existingStatus: conflictingItem.status,
      },
    });
  }

  const claimedSubtotalAmount = decimal(document?.subtotalAmount, 'claimedSubtotalAmount');
  const claimedVatAmount = decimal(eligibility.eligibleVatAmount, 'claimedVatAmount');
  const claimedTotalAmount = decimal(
    Number(claimedSubtotalAmount) + Number(claimedVatAmount),
    'claimedTotalAmount',
  );

  const row = await repository.selectDocumentForFiling({
    batchId: normalizedBatchId,
    taxDocumentId: normalizedTaxDocumentId,
    claimedSubtotalAmount,
    claimedVatAmount,
    claimedTotalAmount,
    eligibilitySnapshot: eligibility,
    documentSnapshot: {
      taxDocumentId: normalizedTaxDocumentId,
      documentType: document?.documentType || null,
      documentNumber: document?.documentNumber || null,
      documentDate: document?.issuedAt || null,
      receivedAt: document?.occurredAt || null,
      supplierTaxId: document?.counterpartyTaxId || null,
      currency: document?.currency || 'THB',
      subtotalAmount: decimal(document?.subtotalAmount, 'document.subtotalAmount'),
      vatAmount: decimal(document?.vatAmount ?? document?.taxAmount, 'document.vatAmount'),
      totalAmount: decimal(document?.totalAmount, 'document.totalAmount'),
    },
    selectedAt,
  }, tx);

  return mapRow(row);
};

const removeTaxDocumentFromFiling = async ({ batchId, taxDocumentId, removedReason = null, removedAt = new Date() }, tx) => {
  const normalizedBatchId = positiveInt(batchId, 'batchId');
  const normalizedTaxDocumentId = positiveInt(taxDocumentId, 'taxDocumentId');
  await assertBatchPeriodMutable({ batchId: normalizedBatchId }, tx);
  const row = await repository.removeDocumentFromFiling({
    batchId: normalizedBatchId,
    taxDocumentId: normalizedTaxDocumentId,
    removedAt,
    removedReason,
  }, tx);
  if (!row) {
    throw Object.assign(new Error('Selected input tax filing item was not found'), {
      code: 'INPUT_TAX_FILING_ITEM_NOT_MUTABLE',
      statusCode: 409,
    });
  }
  return mapRow(row);
};

const markInputTaxBatchFiled = async ({ batchId, filedAt = new Date() }, tx) => {
  const normalizedBatchId = positiveInt(batchId, 'batchId');
  const affectedDocumentCount = await repository.markBatchFiled({
    batchId: normalizedBatchId,
    filedAt,
  }, tx);
  return Object.freeze({
    batchId: normalizedBatchId,
    status: 'FILED',
    filedAt,
    affectedDocumentCount: Number(affectedDocumentCount),
  });
};

module.exports = Object.freeze({
  PERIOD_MUTATION_BLOCKED_STATUSES,
  assertBatchPeriodMutable,
  markInputTaxBatchFiled,
  removeTaxDocumentFromFiling,
  selectTaxDocumentForFiling,
});
