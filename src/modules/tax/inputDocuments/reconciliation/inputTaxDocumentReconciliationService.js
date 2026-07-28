'use strict';

const receiptLinkRepository = require('../links/inputTaxReceiptLinkRepository');

const MONEY_TOLERANCE = 0.01;

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const variance = (documentAmount, allocatedAmount) => money(documentAmount - allocatedAmount);
const matches = (value) => Math.abs(value) <= MONEY_TOLERANCE;

const projectInputTaxReconciliation = async ({ document }, tx) => {
  if (!document || document.documentType !== 'INPUT_TAX_INVOICE') return null;

  const allocated = await receiptLinkRepository.sumActiveDocumentAllocations({
    taxDocumentId: document.id,
  }, tx);
  const documentAmount = Object.freeze({
    subtotalAmount: money(document.subtotalAmount),
    vatAmount: money(document.taxAmount),
    totalAmount: money(document.totalAmount),
  });
  const allocatedAmount = Object.freeze({
    subtotalAmount: money(allocated.subtotalAmount),
    vatAmount: money(allocated.vatAmount),
    totalAmount: money(allocated.totalAmount),
  });
  const amountVariance = Object.freeze({
    subtotalAmount: variance(documentAmount.subtotalAmount, allocatedAmount.subtotalAmount),
    vatAmount: variance(documentAmount.vatAmount, allocatedAmount.vatAmount),
    totalAmount: variance(documentAmount.totalAmount, allocatedAmount.totalAmount),
  });
  const hasReceiptLinks = allocated.receiptCount > 0;
  const reconciled = hasReceiptLinks
    && matches(amountVariance.subtotalAmount)
    && matches(amountVariance.vatAmount)
    && matches(amountVariance.totalAmount);

  return Object.freeze({
    status: reconciled ? 'RECONCILED' : 'UNRECONCILED',
    canApprove: reconciled,
    receiptCount: allocated.receiptCount,
    documentAmount,
    allocatedAmount,
    variance: amountVariance,
    tolerance: MONEY_TOLERANCE,
  });
};

const assertInputTaxDocumentReconciled = async ({ document }, tx) => {
  const reconciliation = await projectInputTaxReconciliation({ document }, tx);
  if (!reconciliation || reconciliation.canApprove) return reconciliation;

  throw Object.assign(
    new Error(
      reconciliation.receiptCount === 0
        ? 'Input tax invoice requires at least one active receipt link before approval'
        : 'Input tax invoice receipt allocations do not reconcile with document amounts',
    ),
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
});
