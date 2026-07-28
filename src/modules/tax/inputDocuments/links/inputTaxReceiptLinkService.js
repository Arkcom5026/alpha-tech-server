'use strict';

const crypto = require('node:crypto');
const { prisma } = require('../../../../../lib/prisma');
const repository = require('./inputTaxReceiptLinkRepository');

const SOURCE_TYPES = Object.freeze(['PO_RECEIPT', 'QUICK_RECEIPT']);
const MUTABLE_DOCUMENT_STATUSES = Object.freeze([
  'DRAFT',
  'REGISTERED',
  'UNDER_REVIEW',
  'REJECTED',
]);
const LOCKED_PERIOD_STATUSES = Object.freeze(['LOCKED', 'SUBMITTED']);

const fail = (message, code, statusCode = 400, details) => {
  throw Object.assign(new Error(message), { code, statusCode, details });
};
const positiveInt = (value, code, fieldName) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) fail(`${fieldName} must be a positive integer`, code);
  return number;
};
const money = (value, fieldName) => {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) fail(`${fieldName} must be a non-negative number`, 'INPUT_TAX_LINK_ALLOCATION_INVALID');
  return Math.round((number + Number.EPSILON) * 100) / 100;
};
const normalizeAllocation = (input = {}) => Object.freeze({
  allocatedSubtotal: money(input.allocatedSubtotal, 'allocatedSubtotal'),
  allocatedVatAmount: money(input.allocatedVatAmount, 'allocatedVatAmount'),
  allocatedTotalAmount: money(input.allocatedTotalAmount, 'allocatedTotalAmount'),
});
const normalizeReference = (input = {}) => {
  const sourceType = String(input.sourceType || '').trim().toUpperCase();
  if (!SOURCE_TYPES.includes(sourceType)) fail('sourceType must be PO_RECEIPT or QUICK_RECEIPT', 'INPUT_TAX_LINK_SOURCE_INVALID');
  return Object.freeze({
    sourceType,
    sourceId: String(positiveInt(input.sourceId, 'INPUT_TAX_LINK_SOURCE_ID_INVALID', 'sourceId')),
    ...normalizeAllocation(input),
  });
};
const assertDocumentMutable = (document) => {
  if (!MUTABLE_DOCUMENT_STATUSES.includes(String(document.status).toUpperCase())) {
    fail('Tax document requires correction or replacement before receipt links can change', 'INPUT_TAX_LINK_DOCUMENT_LOCKED', 409);
  }
  if (LOCKED_PERIOD_STATUSES.includes(String(document.taxPeriodStatus || '').toUpperCase())) {
    fail('Tax period is locked or submitted', 'INPUT_TAX_LINK_PERIOD_LOCKED', 409);
  }
};
const assertCapacity = ({ receipt, existing, allocation }) => {
  const next = {
    subtotalAmount: existing.subtotalAmount + allocation.allocatedSubtotal,
    vatAmount: existing.vatAmount + allocation.allocatedVatAmount,
    totalAmount: existing.totalAmount + allocation.allocatedTotalAmount,
  };
  const exceeds = (actual, maximum) => maximum != null && actual > maximum + 0.001;
  if (
    exceeds(next.subtotalAmount, receipt.subtotalAmount)
    || exceeds(next.vatAmount, receipt.vatAmount)
    || exceeds(next.totalAmount, receipt.totalAmount)
  ) {
    fail('Active allocations exceed receipt amount', 'INPUT_TAX_LINK_ALLOCATION_EXCEEDED', 409, {
      receipt: {
        subtotalAmount: receipt.subtotalAmount,
        vatAmount: receipt.vatAmount,
        totalAmount: receipt.totalAmount,
      },
      requestedActiveTotal: next,
    });
  }
};
const assertDocumentCapacity = ({ document, existing, allocation }) => {
  const next = {
    subtotalAmount: existing.subtotalAmount + allocation.allocatedSubtotal,
    vatAmount: existing.vatAmount + allocation.allocatedVatAmount,
    totalAmount: existing.totalAmount + allocation.allocatedTotalAmount,
  };
  const maximum = {
    subtotalAmount: Number(document.subtotalAmount || 0),
    vatAmount: Number(document.taxAmount || 0),
    totalAmount: Number(document.totalAmount || 0),
  };
  const exceedsKnownAmount = (actual, limit) => limit > 0 && actual > limit + 0.001;
  if (
    exceedsKnownAmount(next.subtotalAmount, maximum.subtotalAmount)
    || exceedsKnownAmount(next.vatAmount, maximum.vatAmount)
    || exceedsKnownAmount(next.totalAmount, maximum.totalAmount)
  ) {
    fail(
      'Active receipt allocations exceed tax document amount',
      'INPUT_TAX_LINK_DOCUMENT_ALLOCATION_EXCEEDED',
      409,
      { documentAmount: maximum, requestedActiveTotal: next },
    );
  }
};
const resolveDocumentAndReceipt = async ({ branchId, taxDocumentId, reference }, tx) => {
  const document = await repository.findDocumentForUpdate({ branchId, taxDocumentId }, tx);
  if (!document) fail('Tax document not found', 'TAX_DOCUMENT_NOT_FOUND', 404);
  assertDocumentMutable(document);
  const receipt = await repository.findReceiptForUpdate({ branchId, ...reference }, tx);
  if (!receipt) fail('Receipt not found in branch', 'INPUT_TAX_LINK_RECEIPT_NOT_FOUND', 404);
  if (String(receipt.status).toUpperCase() !== 'COMPLETED') {
    fail('Only completed receipts can be linked', 'INPUT_TAX_LINK_RECEIPT_NOT_COMPLETED', 409);
  }
  return { document, receipt };
};

const attachReceiptLinks = async ({ branchId, taxDocumentId, commandKey, receiptReferences, actorEmployeeId }) => {
  const normalizedBranchId = positiveInt(branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const normalizedDocumentId = positiveInt(taxDocumentId, 'TAX_DOCUMENT_ID_REQUIRED', 'taxDocumentId');
  const normalizedCommandKey = String(commandKey || '').trim();
  if (!normalizedCommandKey) fail('commandKey is required', 'INPUT_TAX_LINK_COMMAND_KEY_REQUIRED');
  if (!Array.isArray(receiptReferences) || receiptReferences.length === 0) {
    fail('receiptReferences must contain at least one receipt', 'INPUT_TAX_LINK_RECEIPTS_REQUIRED');
  }
  const references = receiptReferences.map(normalizeReference);
  const identitySet = new Set(references.map((item) => `${item.sourceType}:${item.sourceId}`));
  if (identitySet.size !== references.length) fail('Duplicate receipt reference', 'INPUT_TAX_LINK_DUPLICATE_SOURCE');

  return prisma.$transaction(async (tx) => {
    const links = [];
    let createdCount = 0;
    let authoritySupplierId = null;
    for (const reference of references) {
      const linkKey = crypto.createHash('sha256')
        .update(`${normalizedBranchId}:${normalizedDocumentId}:${normalizedCommandKey}:${reference.sourceType}:${reference.sourceId}`)
        .digest('hex');
      const replay = await repository.findByLinkKey(linkKey, tx);
      if (replay) {
        links.push(replay);
        authoritySupplierId ??= replay.supplierId;
        continue;
      }
      const existingDocumentLink = await repository.findActiveByDocumentSource({
        taxDocumentId: normalizedDocumentId,
        sourceType: reference.sourceType,
        sourceId: reference.sourceId,
      }, tx);
      if (existingDocumentLink) {
        fail(
          'Receipt is already linked to this tax document; use the reallocation command',
          'INPUT_TAX_LINK_ALREADY_ACTIVE',
          409,
          { linkId: existingDocumentLink.id },
        );
      }
      const { document, receipt } = await resolveDocumentAndReceipt({
        branchId: normalizedBranchId, taxDocumentId: normalizedDocumentId, reference,
      }, tx);
      authoritySupplierId ??= document.supplierId || receipt.supplierId;
      if (receipt.supplierId !== authoritySupplierId) {
        fail('All receipts and the tax document must have the same supplier', 'INPUT_TAX_LINK_SUPPLIER_MISMATCH', 409);
      }
      const existing = await repository.sumActiveAllocations({
        branchId: normalizedBranchId, sourceType: reference.sourceType, sourceId: reference.sourceId,
      }, tx);
      assertCapacity({ receipt, existing, allocation: reference });
      const existingDocumentAllocations = await repository.sumActiveDocumentAllocations({
        taxDocumentId: normalizedDocumentId,
      }, tx);
      assertDocumentCapacity({
        document,
        existing: existingDocumentAllocations,
        allocation: reference,
      });
      const link = await repository.create({
        taxDocumentId: normalizedDocumentId,
        branchId: normalizedBranchId,
        supplierId: authoritySupplierId,
        ...reference,
        receiptCode: receipt.receiptCode,
        deliveryNoteNumber: receipt.deliveryNoteNumber || null,
        linkKey,
        actorEmployeeId: actorEmployeeId || null,
      }, tx);
      createdCount += 1;
      await repository.appendEvent({
        linkId: link.id, eventType: 'LINKED', actorEmployeeId: actorEmployeeId || null,
        reason: null, beforeSnapshot: null, afterSnapshot: link,
      }, tx);
      links.push(link);
    }
    return Object.freeze({ replayed: createdCount === 0, links });
  });
};

const reallocateReceiptLink = async ({ branchId, taxDocumentId, linkId, allocation, reason, actorEmployeeId }) => {
  const normalized = {
    branchId: positiveInt(branchId, 'TAX_BRANCH_REQUIRED', 'branchId'),
    taxDocumentId: positiveInt(taxDocumentId, 'TAX_DOCUMENT_ID_REQUIRED', 'taxDocumentId'),
    linkId: positiveInt(linkId, 'INPUT_TAX_LINK_ID_REQUIRED', 'linkId'),
  };
  const nextAllocation = normalizeAllocation(allocation);
  return prisma.$transaction(async (tx) => {
    const document = await repository.findDocumentForUpdate(normalized, tx);
    if (!document) fail('Tax document not found', 'TAX_DOCUMENT_NOT_FOUND', 404);
    assertDocumentMutable(document);
    const current = await repository.findByIdForUpdate(normalized, tx);
    if (!current || current.state !== 'ACTIVE') fail('Active receipt link not found', 'INPUT_TAX_LINK_NOT_FOUND', 404);
    const receipt = await repository.findReceiptForUpdate({
      branchId: normalized.branchId, sourceType: current.sourceType, sourceId: current.sourceId,
    }, tx);
    if (!receipt) fail('Receipt not found in branch', 'INPUT_TAX_LINK_RECEIPT_NOT_FOUND', 404);
    const existing = await repository.sumActiveAllocations({
      branchId: normalized.branchId, sourceType: current.sourceType,
      sourceId: current.sourceId, excludingLinkId: current.id,
    }, tx);
    assertCapacity({ receipt, existing, allocation: nextAllocation });
    const existingDocumentAllocations = await repository.sumActiveDocumentAllocations({
      taxDocumentId: normalized.taxDocumentId,
      excludingLinkId: current.id,
    }, tx);
    assertDocumentCapacity({
      document,
      existing: existingDocumentAllocations,
      allocation: nextAllocation,
    });
    const updated = await repository.updateAllocation({ linkId: current.id, ...nextAllocation }, tx);
    await repository.appendEvent({
      linkId: current.id, eventType: 'ALLOCATION_CHANGED', actorEmployeeId: actorEmployeeId || null,
      reason: String(reason || '').trim() || null, beforeSnapshot: current, afterSnapshot: updated,
    }, tx);
    return Object.freeze({ link: updated });
  });
};

const cancelReceiptLink = async ({ branchId, taxDocumentId, linkId, reason, actorEmployeeId }) => {
  const normalized = {
    branchId: positiveInt(branchId, 'TAX_BRANCH_REQUIRED', 'branchId'),
    taxDocumentId: positiveInt(taxDocumentId, 'TAX_DOCUMENT_ID_REQUIRED', 'taxDocumentId'),
    linkId: positiveInt(linkId, 'INPUT_TAX_LINK_ID_REQUIRED', 'linkId'),
  };
  const normalizedReason = String(reason || '').trim();
  if (!normalizedReason) fail('Cancellation reason is required', 'INPUT_TAX_LINK_CANCEL_REASON_REQUIRED');
  return prisma.$transaction(async (tx) => {
    const document = await repository.findDocumentForUpdate(normalized, tx);
    if (!document) fail('Tax document not found', 'TAX_DOCUMENT_NOT_FOUND', 404);
    assertDocumentMutable(document);
    const current = await repository.findByIdForUpdate(normalized, tx);
    if (!current) fail('Receipt link not found', 'INPUT_TAX_LINK_NOT_FOUND', 404);
    if (current.state === 'CANCELLED') return Object.freeze({ replayed: true, link: current });
    const cancelled = await repository.cancel({
      linkId: current.id, actorEmployeeId: actorEmployeeId || null, reason: normalizedReason,
    }, tx);
    await repository.appendEvent({
      linkId: current.id, eventType: 'CANCELLED', actorEmployeeId: actorEmployeeId || null,
      reason: normalizedReason, beforeSnapshot: current, afterSnapshot: cancelled,
    }, tx);
    return Object.freeze({ replayed: false, link: cancelled });
  });
};

const listReceiptLinks = ({ branchId, taxDocumentId }) => repository.listByDocument({
  branchId: positiveInt(branchId, 'TAX_BRANCH_REQUIRED', 'branchId'),
  taxDocumentId: positiveInt(taxDocumentId, 'TAX_DOCUMENT_ID_REQUIRED', 'taxDocumentId'),
});

module.exports = Object.freeze({
  attachReceiptLinks,
  cancelReceiptLink,
  listReceiptLinks,
  reallocateReceiptLink,
});
