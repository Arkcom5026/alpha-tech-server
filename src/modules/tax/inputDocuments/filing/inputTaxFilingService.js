'use strict';

const { prisma } = require('../../../../../lib/prisma');
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

const optionalPositiveInt = (value, fieldName) => {
  if (value == null || value === '') return null;
  return positiveInt(value, fieldName);
};

const requiredReason = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw Object.assign(new Error('A reason is required for this filing reversal'), {
      code: 'INPUT_TAX_REASON_REQUIRED',
      statusCode: 400,
    });
  }
  return normalized;
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
const PERIOD_FILING_SUBMIT_BLOCKED_STATUSES = new Set(['CLOSED', 'SUBMITTED']);
const INPUT_VAT_LEDGER_TYPES = new Set(['INPUT_VAT', 'INPUT_VAT_ADJUSTMENT']);

const assertBatchPeriodMutable = async ({ batchId }, tx) => {
  const authority = await repository.findBatchPeriodAuthority({ batchId }, tx);
  if (!authority) {
    throw Object.assign(new Error('Input tax filing batch was not found'), {
      code: 'INPUT_TAX_FILING_BATCH_NOT_FOUND',
      statusCode: 404,
    });
  }
  if (authority.batchStatus && authority.batchStatus !== 'DRAFT') {
    throw Object.assign(new Error('Input tax filing batch is no longer mutable'), {
      code: 'INPUT_TAX_FILING_BATCH_NOT_MUTABLE',
      statusCode: 409,
      details: { batchId: Number(authority.batchId), batchStatus: authority.batchStatus },
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

const assertLockedBatchMutable = (authority) => {
  if (!authority) {
    throw Object.assign(new Error('Input tax filing batch was not found'), {
      code: 'INPUT_TAX_FILING_BATCH_NOT_FOUND',
      statusCode: 404,
    });
  }
  if (authority.batchStatus !== 'DRAFT') {
    throw Object.assign(new Error('Input tax filing batch is no longer mutable'), {
      code: 'INPUT_TAX_FILING_BATCH_NOT_MUTABLE',
      statusCode: 409,
      details: { batchId: Number(authority.batchId), batchStatus: authority.batchStatus },
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

const assertLockedBatchSubmittable = (authority) => {
  if (!authority) {
    throw Object.assign(new Error('Input tax filing batch was not found'), {
      code: 'INPUT_TAX_FILING_BATCH_NOT_FOUND',
      statusCode: 404,
    });
  }
  if (authority.batchStatus !== 'DRAFT') {
    throw Object.assign(new Error('Input tax filing batch is no longer mutable'), {
      code: 'INPUT_TAX_FILING_BATCH_NOT_MUTABLE',
      statusCode: 409,
      details: { batchId: Number(authority.batchId), batchStatus: authority.batchStatus },
    });
  }
  if (PERIOD_FILING_SUBMIT_BLOCKED_STATUSES.has(authority.taxPeriodStatus)) {
    throw Object.assign(new Error('Input tax filing cannot be submitted in the current tax period state'), {
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

const assertInputVatFilingAuthority = ({ authority, branchId, taxDocumentId, document, eligibility }) => {
  if (
    !authority
    || Number(authority.branchId) !== Number(branchId)
    || Number(authority.taxDocumentId) !== Number(taxDocumentId)
    || !INPUT_VAT_LEDGER_TYPES.has(String(authority.ledgerType || ''))
  ) {
    throw Object.assign(new Error('Input VAT authority is required before filing selection'), {
      code: 'INPUT_TAX_FILING_VAT_AUTHORITY_REQUIRED',
      statusCode: 409,
      details: { taxDocumentId: Number(taxDocumentId) },
    });
  }

  const authoritySubtotal = decimal(authority.subtotalAmount, 'authority.subtotalAmount');
  const authorityVat = decimal(authority.taxAmount, 'authority.taxAmount');
  const authorityTotal = decimal(authority.totalAmount, 'authority.totalAmount');
  const documentSubtotal = decimal(document?.subtotalAmount, 'document.subtotalAmount');
  const documentVat = decimal(document?.vatAmount ?? document?.taxAmount, 'document.vatAmount');
  const documentTotal = decimal(document?.totalAmount, 'document.totalAmount');

  if (
    authoritySubtotal !== documentSubtotal
    || authorityVat !== documentVat
    || authorityTotal !== documentTotal
  ) {
    throw Object.assign(new Error('Input VAT authority amounts conflict with the tax document'), {
      code: 'INPUT_TAX_FILING_VAT_AUTHORITY_CONFLICT',
      statusCode: 409,
      details: {
        taxDocumentId: Number(taxDocumentId),
        authority: { subtotalAmount: authoritySubtotal, taxAmount: authorityVat, totalAmount: authorityTotal },
        document: { subtotalAmount: documentSubtotal, taxAmount: documentVat, totalAmount: documentTotal },
      },
    });
  }

  const eligibleVat = Number(decimal(eligibility?.eligibleVatAmount, 'eligibility.eligibleVatAmount'));
  if (eligibleVat > Number(authorityVat)) {
    throw Object.assign(new Error('Eligible VAT cannot exceed the Input VAT authority amount'), {
      code: 'INPUT_TAX_FILING_VAT_AUTHORITY_CONFLICT',
      statusCode: 409,
      details: {
        taxDocumentId: Number(taxDocumentId),
        eligibleVatAmount: eligibleVat.toFixed(2),
        authorityVatAmount: authorityVat,
      },
    });
  }

  return Object.freeze({
    authoritySubtotal,
    authorityVat,
    authorityTotal,
    eligibleVatAmount: eligibleVat.toFixed(2),
  });
};

const mapRow = (row, replayed = false) => Object.freeze({
  ...createFilingItemProjection({
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
  }),
  replayed,
});

const selectTaxDocumentForFiling = async ({
  batchId,
  taxDocumentId,
  reconciliation,
  eligibility,
  document,
  selectedAt = new Date(),
}) => prisma.$transaction(async (tx) => {
  const normalizedBatchId = positiveInt(batchId, 'batchId');
  const normalizedTaxDocumentId = positiveInt(taxDocumentId, 'taxDocumentId');

  const batchAuthority = assertLockedBatchMutable(
    await repository.lockBatchPeriodAuthority({ batchId: normalizedBatchId }, tx),
  );
  const lockedDocument = await repository.lockTaxDocumentForFiling({
    taxDocumentId: normalizedTaxDocumentId,
  }, tx);
  if (!lockedDocument || Number(lockedDocument.branchId) !== Number(batchAuthority.branchId)) {
    throw Object.assign(new Error('Input tax document was not found in this filing branch'), {
      code: 'TAX_DOCUMENT_NOT_FOUND',
      statusCode: 404,
    });
  }

  const activeItems = await repository.findActiveByDocument({
    taxDocumentId: normalizedTaxDocumentId,
  }, tx);
  const sameBatchItem = activeItems.find((item) => Number(item.batchId) === normalizedBatchId);
  if (sameBatchItem) return mapRow(sameBatchItem, true);

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

  const vatAuthority = await repository.lockInputVatAuthorityForFiling({
    taxDocumentId: normalizedTaxDocumentId,
  }, tx);
  const authorityAmounts = assertInputVatFilingAuthority({
    authority: vatAuthority,
    branchId: batchAuthority.branchId,
    taxDocumentId: normalizedTaxDocumentId,
    document,
    eligibility,
  });

  const claimedSubtotalAmount = authorityAmounts.authoritySubtotal;
  const claimedVatAmount = authorityAmounts.eligibleVatAmount;
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
      inputVatRecordId: vatAuthority.id,
      inputVatLedgerType: vatAuthority.ledgerType,
      documentType: document?.documentType || null,
      documentNumber: vatAuthority.documentNumber || document?.documentNumber || null,
      documentDate: vatAuthority.documentDate || document?.issuedAt || null,
      receivedAt: document?.occurredAt || null,
      supplierTaxId: document?.counterpartyTaxId || null,
      currency: vatAuthority.currency || document?.currency || 'THB',
      subtotalAmount: authorityAmounts.authoritySubtotal,
      vatAmount: authorityAmounts.authorityVat,
      totalAmount: authorityAmounts.authorityTotal,
      claimedVatAmount,
    },
    selectedAt,
  }, tx);

  return mapRow(row, false);
});

const removeTaxDocumentFromFiling = async ({
  batchId,
  taxDocumentId,
  removedReason,
  expectedVersion,
  removedAt = new Date(),
}) => prisma.$transaction(async (tx) => {
  const normalizedBatchId = positiveInt(batchId, 'batchId');
  const normalizedTaxDocumentId = positiveInt(taxDocumentId, 'taxDocumentId');
  const normalizedExpectedVersion = optionalPositiveInt(expectedVersion, 'expectedVersion');
  const normalizedReason = requiredReason(removedReason);

  assertLockedBatchMutable(
    await repository.lockBatchPeriodAuthority({ batchId: normalizedBatchId }, tx),
  );
  const current = await repository.findBatchDocumentItemForUpdate({
    batchId: normalizedBatchId,
    taxDocumentId: normalizedTaxDocumentId,
  }, tx);
  if (!current) {
    throw Object.assign(new Error('Selected input tax filing item was not found'), {
      code: 'INPUT_TAX_FILING_ITEM_NOT_MUTABLE',
      statusCode: 409,
    });
  }
  if (current.status === 'REMOVED') return mapRow(current, true);
  if (current.status !== 'SELECTED') {
    throw Object.assign(new Error('Input tax filing item is no longer selectable for removal'), {
      code: 'INPUT_TAX_FILING_ITEM_NOT_MUTABLE',
      statusCode: 409,
      details: { currentStatus: current.status, currentVersion: Number(current.version) },
    });
  }
  if (normalizedExpectedVersion != null && Number(current.version) !== normalizedExpectedVersion) {
    throw Object.assign(new Error('Input tax filing item version is stale'), {
      code: 'INPUT_TAX_STALE_VERSION',
      statusCode: 409,
      details: { expectedVersion: normalizedExpectedVersion, currentVersion: Number(current.version) },
    });
  }

  const row = await repository.removeDocumentFromFiling({
    batchId: normalizedBatchId,
    taxDocumentId: normalizedTaxDocumentId,
    removedAt,
    removedReason: normalizedReason,
    expectedVersion: normalizedExpectedVersion,
  }, tx);
  if (!row) {
    throw Object.assign(new Error('Input tax filing item changed before removal completed'), {
      code: 'INPUT_TAX_STALE_VERSION',
      statusCode: 409,
    });
  }
  return mapRow(row, false);
});

const markInputTaxBatchFiled = async ({ branchId, batchId, filedAt = new Date() }) => prisma.$transaction(async (tx) => {
  const normalizedBranchId = positiveInt(branchId, 'branchId');
  const normalizedBatchId = positiveInt(batchId, 'batchId');
  const authority = await repository.lockBatchPeriodAuthority({ batchId: normalizedBatchId }, tx);
  if (!authority) {
    throw Object.assign(new Error('Input tax filing batch was not found'), {
      code: 'INPUT_TAX_FILING_BATCH_NOT_FOUND',
      statusCode: 404,
    });
  }
  if (Number(authority.branchId) !== normalizedBranchId) {
    throw Object.assign(new Error('Filing batch does not belong to the requested branch'), {
      code: 'INPUT_TAX_FILING_BATCH_BRANCH_MISMATCH',
      statusCode: 403,
    });
  }
  if (authority.batchStatus === 'SUBMITTED') {
    return Object.freeze({
      batchId: normalizedBatchId,
      status: 'SUBMITTED',
      filedAt: null,
      affectedDocumentCount: 0,
      replayed: true,
    });
  }
  assertLockedBatchSubmittable(authority);

  const result = await repository.submitBatch({ batchId: normalizedBatchId, filedAt }, tx);
  if (!result.batch) {
    throw Object.assign(new Error('Input tax filing batch changed before submission completed'), {
      code: 'INPUT_TAX_FILING_STALE',
      statusCode: 409,
    });
  }
  return Object.freeze({
    batchId: normalizedBatchId,
    status: 'SUBMITTED',
    filedAt,
    affectedDocumentCount: result.itemCount,
    replayed: false,
  });
});

module.exports = Object.freeze({
  INPUT_VAT_LEDGER_TYPES,
  PERIOD_FILING_SUBMIT_BLOCKED_STATUSES,
  PERIOD_MUTATION_BLOCKED_STATUSES,
  assertBatchPeriodMutable,
  assertInputVatFilingAuthority,
  assertLockedBatchSubmittable,
  markInputTaxBatchFiled,
  removeTaxDocumentFromFiling,
  selectTaxDocumentForFiling,
});