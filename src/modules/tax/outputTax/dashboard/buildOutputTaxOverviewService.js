'use strict';

const { buildOutputTaxPeriodReport } = require('../reporting/buildOutputTaxPeriodReportService');

const normalizePositiveInt = (value, code, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), { code, statusCode: 400 });
  }
  return parsed;
};

const previousPeriod = (year, month) => (month === 1
  ? Object.freeze({ year: year - 1, month: 12 })
  : Object.freeze({ year, month: month - 1 }));

const amount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const percentChange = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const buildSourceSummary = (documents) => Object.freeze(
  documents.reduce((summary, document) => {
    const key = document.sourceType || 'UNLINKED';
    const current = summary[key] || {
      documentCount: 0,
      subtotalAmount: 0,
      taxAmount: 0,
      totalAmount: 0,
    };
    summary[key] = {
      documentCount: current.documentCount + 1,
      subtotalAmount: current.subtotalAmount + amount(document.subtotalAmount),
      taxAmount: current.taxAmount + amount(document.taxAmount),
      totalAmount: current.totalAmount + amount(document.totalAmount),
    };
    return summary;
  }, {}),
);

const buildOutputTaxOverview = async ({ branchId, year, month }) => {
  const normalizedBranchId = normalizePositiveInt(branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const normalizedYear = normalizePositiveInt(year, 'OUTPUT_TAX_YEAR_REQUIRED', 'year');
  const normalizedMonth = normalizePositiveInt(month, 'OUTPUT_TAX_MONTH_REQUIRED', 'month');
  if (normalizedMonth > 12) {
    throw Object.assign(new Error('month must be between 1 and 12'), {
      code: 'OUTPUT_TAX_MONTH_INVALID',
      statusCode: 400,
    });
  }

  const prior = previousPeriod(normalizedYear, normalizedMonth);
  const [current, previous] = await Promise.all([
    buildOutputTaxPeriodReport({ branchId: normalizedBranchId, year: normalizedYear, month: normalizedMonth }),
    buildOutputTaxPeriodReport({ branchId: normalizedBranchId, year: prior.year, month: prior.month }),
  ]);

  const currentActiveDocuments = current.documents.filter((document) => !document.isCancelled);
  const unlinkedDocumentCount = currentActiveDocuments.filter((document) => !document.sourceType || !document.sourceId).length;
  const missingCounterpartyTaxIdCount = currentActiveDocuments.filter((document) => !document.counterpartyTaxId).length;
  const replacementDocumentCount = currentActiveDocuments.filter((document) => document.replacementOf).length;

  return Object.freeze({
    schemaVersion: 'OUTPUT_TAX_OVERVIEW_V1',
    branchId: normalizedBranchId,
    period: Object.freeze({ year: normalizedYear, month: normalizedMonth }),
    previousPeriod: Object.freeze(prior),
    currency: current.currency,
    headline: Object.freeze({
      documentCount: current.documentCount,
      activeDocumentCount: current.activeDocumentCount,
      cancelledDocumentCount: current.cancelledDocumentCount,
      subtotalAmount: current.totals.subtotalAmount,
      taxAmount: current.totals.taxAmount,
      totalAmount: current.totals.totalAmount,
    }),
    comparison: Object.freeze({
      previousTaxAmount: previous.totals.taxAmount,
      taxAmountChange: current.totals.taxAmount - previous.totals.taxAmount,
      taxAmountChangePercent: percentChange(current.totals.taxAmount, previous.totals.taxAmount),
      previousTotalAmount: previous.totals.totalAmount,
      totalAmountChange: current.totals.totalAmount - previous.totals.totalAmount,
      totalAmountChangePercent: percentChange(current.totals.totalAmount, previous.totals.totalAmount),
    }),
    quality: Object.freeze({
      unlinkedDocumentCount,
      missingCounterpartyTaxIdCount,
      replacementDocumentCount,
      hasAttentionItems: unlinkedDocumentCount > 0 || missingCounterpartyTaxIdCount > 0,
    }),
    byDocumentType: current.byDocumentType,
    bySourceType: buildSourceSummary(currentActiveDocuments),
    recentDocuments: Object.freeze([...current.documents].reverse().slice(0, 10)),
  });
};

module.exports = Object.freeze({ buildOutputTaxOverview });
