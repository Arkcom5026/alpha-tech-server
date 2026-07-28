'use strict';

const SCHEMA_VERSION = 'INPUT_TAX_OVERVIEW_V1';
const PERIOD_VIEWS = Object.freeze(['DOCUMENT', 'RECEIVED', 'CLAIM', 'FILED']);

const decimalString = (value) => {
  if (value === null || value === undefined || value === '') return '0.00';
  return String(value);
};

const emptyMoney = () => Object.freeze({
  subtotalAmount: '0.00',
  vatAmount: '0.00',
  totalAmount: '0.00',
});

const createEmptyOverview = ({ branchId, periodView, periodFrom, periodTo, currency = 'THB' }) => ({
  schemaVersion: SCHEMA_VERSION,
  scope: {
    branchId,
    periodView,
    periodFrom,
    periodTo,
    currency,
    generatedAt: new Date().toISOString(),
  },
  headline: {
    documentCount: 0,
    activeDocumentCount: 0,
    cancelledDocumentCount: 0,
    ...emptyMoney(),
    reconciledVatAmount: '0.00',
    claimableVatAmount: '0.00',
    selectedVatAmount: '0.00',
    filedVatAmount: '0.00',
    deferredVatAmount: '0.00',
    blockedVatAmount: '0.00',
  },
  comparison: {
    previousDocumentVatAmount: '0.00',
    documentVatAmountChange: '0.00',
    documentVatAmountChangePercent: null,
    previousClaimableVatAmount: '0.00',
    claimableVatAmountChange: '0.00',
    claimableVatAmountChangePercent: null,
    percentChangeReason: 'NO_COMPARABLE_BASE',
  },
  reconciliation: {
    unlinkedDocumentCount: 0,
    partiallyLinkedDocumentCount: 0,
    fullyLinkedDocumentCount: 0,
    allocationMatchedDocumentCount: 0,
    allocationMismatchDocumentCount: 0,
    allocationDifferenceAmount: '0.00',
    unreconciledVatAmount: '0.00',
  },
  quality: {
    missingSupplierTaxIdCount: 0,
    missingInvoiceNumberCount: 0,
    duplicateInvoiceRiskCount: 0,
    replacementDocumentCount: 0,
    agingPendingDocumentCount: 0,
    attentionItemCount: 0,
    hasAttentionItems: false,
  },
  filingReadiness: {
    readyDocumentCount: 0,
    blockedDocumentCount: 0,
    selectedDocumentCount: 0,
    filedDocumentCount: 0,
    deferredDocumentCount: 0,
    readyVatAmount: '0.00',
    blockedVatAmount: '0.00',
    selectedVatAmount: '0.00',
    filedVatAmount: '0.00',
    deferredVatAmount: '0.00',
    blockerSummary: [],
  },
  byDocumentType: [],
  bySourceType: [],
  bySupplier: [],
  recentDocuments: [],
});

module.exports = Object.freeze({
  SCHEMA_VERSION,
  PERIOD_VIEWS,
  decimalString,
  emptyMoney,
  createEmptyOverview,
});
