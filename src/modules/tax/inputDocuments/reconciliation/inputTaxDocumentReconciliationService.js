'use strict';

const receiptLinkRepository = require('../links/inputTaxReceiptLinkRepository');
const {
  MONEY_TOLERANCE,
  createReconciliationProjection,
} = require('./inputTaxReconciliationContract');

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const moneyString = (value) => money(value).toFixed(2);
const variance = (documentAmount, allocatedAmount) => money(documentAmount - allocatedAmount);
const matches = (value) => Math.abs(value) <= Number(MONEY_TOLERANCE);
const isOverAllocated = (value) => value < -Number(MONEY_TOLERANCE);

const resolveStatus = ({ receiptCount, amountVariance }) => {
  if (receiptCount === 0) return 'UNLINKED';
  if (
    isOverAllocated(amountVariance.subtotalAmount)
    || isOverAllocated(amountVariance.vatAmount)
    || isOverAllocated(amountVariance.totalAmount)
  ) return 'OVER_ALLOCATED';
  if (
    matches(amountVariance.subtotalAmount)
    && matches(amountVariance.vatAmount)
    && matches(amountVariance.totalAmount)
  ) return 'RECONCILED';
  return 'PARTIALLY_RECONCILED';
};

const projectInputTaxReconciliation = async ({ document }, tx) => {
  if (!document || document.documentType !== 'INPUT_TAX_INVOICE') return null;

  const allocated = await receiptLinkRepository.sumActiveDocumentAllocations({
    taxDocumentId: document.id,
  }, tx);
  const numericDocumentAmount = {
    subtotalAmount: money(document.subtotalAmount),
    vatAmount: money(document.taxAmount),
    totalAmount: money(document.totalAmount),
  };
  const numericAllocatedAmount = {
    subtotalAmount: money(allocated.subtotalAmount),
    vatAmount: money(allocated.vatAmount),
    totalAmount: money(allocated.totalAmount),
  };
  const numericVariance = {
    subtotalAmount: variance(numericDocumentAmount.subtotalAmount, numericAllocatedAmount.subtotalAmount),
    vatAmount: variance(numericDocumentAmount.vatAmount, numericAllocatedAmount.vatAmount),
    totalAmount: variance(numericDocumentAmount.totalAmount, numericAllocatedAmount.totalAmount),
  };
  const status = resolveStatus({ receiptCount: allocated.receiptCount, amountVariance: numericVariance });
  const qualityCodes = [
    status === 'UNLINKED' ? 'UNLINKED_DOCUMENT' : null,
    status === 'PARTIALLY_RECONCILED' ? 'ALLOCATION_MISMATCH' : null,
    status === 'OVER_ALLOCATED' ? 'OVER_ALLOCATED' : null,
  ].filter(Boolean);

  return createReconciliationProjection({
    status,
    receiptCount: allocated.receiptCount,
    documentAmount: Object.freeze({
      subtotalAmount: moneyString(numericDocumentAmount.subtotalAmount),
      vatAmount: moneyString(numericDocumentAmount.vatAmount),
      totalAmount: moneyString(numericDocumentAmount.totalAmount),
    }),
    allocatedAmount: Object.freeze({
      subtotalAmount: moneyString(numericAllocatedAmount.subtotalAmount),
      vatAmount: moneyString(numericAllocatedAmount.vatAmount),
      totalAmount: moneyString(numericAllocatedAmount.totalAmount),
    }),
    variance: Object.freeze({
      subtotalAmount: moneyString(numericVariance.subtotalAmount),
      vatAmount: moneyString(numericVariance.vatAmount),
      totalAmount: moneyString(numericVariance.totalAmount),
    }),
    qualityCodes,
  });
};

const assertInputTaxDocumentReconciled = async ({ document }, tx) => {
  const reconciliation = await projectInputTaxReconciliation({ document }, tx);
  if (!reconciliation || reconciliation.canApprove) return reconciliation;

  const messageByStatus = {
    UNLINKED: 'Input tax invoice requires at least one active receipt link before approval',
    PARTIALLY_RECONCILED: 'Input tax invoice receipt allocations do not reconcile with document amounts',
    OVER_ALLOCATED: 'Input tax invoice receipt allocations exceed document amounts',
  };

  throw Object.assign(
    new Error(messageByStatus[reconciliation.status] || 'Input tax invoice reconciliation is required'),
    {
      code: 'INPUT_TAX_RECONCILIATION_REQUIRED',
      statusCode: 409,
      isOperational: true,
      details: reconciliation,
    },
  );
};

module.exports = Object.freeze({
  assertInputTaxDocumentReconciled,
  projectInputTaxReconciliation,
  resolveStatus,
});
