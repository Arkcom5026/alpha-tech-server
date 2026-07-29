'use strict';

const FILING_ITEM_STATUSES = Object.freeze([
  'SELECTED',
  'FILED',
  'REMOVED',
  'VOIDED',
]);

const decimalString = (value) => Number(value || 0).toFixed(2);

const createFilingItemProjection = ({
  id,
  batchId,
  taxDocumentId,
  legacyPurchaseOrderReceiptId = null,
  status,
  claimedSubtotalAmount,
  claimedVatAmount,
  claimedTotalAmount,
  eligibilitySnapshot,
  documentSnapshot,
  selectedAt,
  filedAt = null,
  version,
}) => Object.freeze({
  id,
  batchId,
  taxDocumentId,
  legacyPurchaseOrderReceiptId,
  status,
  amounts: Object.freeze({
    claimedSubtotalAmount: decimalString(claimedSubtotalAmount),
    claimedVatAmount: decimalString(claimedVatAmount),
    claimedTotalAmount: decimalString(claimedTotalAmount),
  }),
  eligibilitySnapshot: eligibilitySnapshot || null,
  documentSnapshot: documentSnapshot || null,
  selectedAt,
  filedAt,
  version,
});

module.exports = Object.freeze({
  FILING_ITEM_STATUSES,
  createFilingItemProjection,
});
