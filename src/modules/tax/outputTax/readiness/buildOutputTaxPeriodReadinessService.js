'use strict';

const { buildOutputTaxPeriodReport } = require('../reporting/buildOutputTaxPeriodReportService');

const normalizePositiveInt = (value, code, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), { code, statusCode: 400 });
  }
  return parsed;
};

const normalizeYear = (value) => {
  const year = normalizePositiveInt(value, 'OUTPUT_TAX_YEAR_REQUIRED', 'year');
  if (year < 2000 || year > 2200) {
    throw Object.assign(new Error('year must be between 2000 and 2200'), {
      code: 'OUTPUT_TAX_YEAR_INVALID',
      statusCode: 400,
    });
  }
  return year;
};

const normalizeMonth = (value) => {
  const month = normalizePositiveInt(value, 'OUTPUT_TAX_MONTH_REQUIRED', 'month');
  if (month > 12) {
    throw Object.assign(new Error('month must be between 1 and 12'), {
      code: 'OUTPUT_TAX_MONTH_INVALID',
      statusCode: 400,
    });
  }
  return month;
};

const buildOutputTaxPeriodReadiness = async ({ branchId, year, month }) => {
  const normalizedBranchId = normalizePositiveInt(branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const normalizedYear = normalizeYear(year);
  const normalizedMonth = normalizeMonth(month);
  const report = await buildOutputTaxPeriodReport({
    branchId: normalizedBranchId,
    year: normalizedYear,
    month: normalizedMonth,
  });

  const activeDocuments = report.documents.filter((document) => !document.isCancelled);
  const cancelledDocuments = report.documents.filter((document) => document.isCancelled);
  const unissuedDocuments = report.documents.filter((document) => !document.issuedAt);
  const missingDocumentNumber = activeDocuments.filter((document) => !String(document.documentNumber || '').trim());
  const unlinkedSourceDocuments = activeDocuments.filter((document) => !document.sourceType || !document.sourceId);
  const missingCounterpartyTaxId = activeDocuments.filter((document) => !document.counterpartyTaxId);
  const negativeAmountDocuments = activeDocuments.filter((document) => (
    Number(document.subtotalAmount) < 0 || Number(document.taxAmount) < 0 || Number(document.totalAmount) < 0
  ));
  const nonThbDocuments = activeDocuments.filter((document) => String(document.currency || 'THB').toUpperCase() !== 'THB');

  const checks = [
    {
      code: 'ALL_DOCUMENTS_ISSUED',
      passed: unissuedDocuments.length === 0,
      blocking: true,
      affectedDocumentCount: unissuedDocuments.length,
      message: unissuedDocuments.length === 0 ? null : 'Some output tax documents are not issued',
    },
    {
      code: 'DOCUMENT_NUMBERS_COMPLETE',
      passed: missingDocumentNumber.length === 0,
      blocking: true,
      affectedDocumentCount: missingDocumentNumber.length,
      message: missingDocumentNumber.length === 0 ? null : 'Some active output tax documents have no document number',
    },
    {
      code: 'SOURCE_LINKS_COMPLETE',
      passed: unlinkedSourceDocuments.length === 0,
      blocking: true,
      affectedDocumentCount: unlinkedSourceDocuments.length,
      message: unlinkedSourceDocuments.length === 0 ? null : 'Some active output tax documents are not linked to source transactions',
    },
    {
      code: 'COUNTERPARTY_TAX_IDS_COMPLETE',
      passed: missingCounterpartyTaxId.length === 0,
      blocking: false,
      affectedDocumentCount: missingCounterpartyTaxId.length,
      message: missingCounterpartyTaxId.length === 0 ? null : 'Some active output tax documents have no counterparty tax ID',
    },
    {
      code: 'AMOUNTS_NON_NEGATIVE',
      passed: negativeAmountDocuments.length === 0,
      blocking: true,
      affectedDocumentCount: negativeAmountDocuments.length,
      message: negativeAmountDocuments.length === 0 ? null : 'Some active output tax documents have negative amounts',
    },
    {
      code: 'CURRENCY_THAI_BAHT',
      passed: nonThbDocuments.length === 0,
      blocking: false,
      affectedDocumentCount: nonThbDocuments.length,
      message: nonThbDocuments.length === 0 ? null : 'Some active output tax documents use a currency other than THB',
    },
    {
      code: 'CANCELLATIONS_REVIEWED',
      passed: true,
      blocking: false,
      affectedDocumentCount: cancelledDocuments.length,
      message: cancelledDocuments.length === 0 ? null : 'Cancelled output tax documents should be reviewed before filing',
    },
  ];

  const blockingFailures = checks.filter((check) => check.blocking && !check.passed);
  const warnings = checks.filter((check) => !check.blocking && !check.passed);

  return Object.freeze({
    schemaVersion: 'OUTPUT_TAX_PERIOD_READINESS_V1',
    branchId: normalizedBranchId,
    period: Object.freeze({ year: normalizedYear, month: normalizedMonth }),
    currency: report.currency,
    documentCount: report.documentCount,
    activeDocumentCount: report.activeDocumentCount,
    cancelledDocumentCount: report.cancelledDocumentCount,
    totals: report.totals,
    readyForFiling: blockingFailures.length === 0,
    blockingFailureCount: blockingFailures.length,
    warningCount: warnings.length,
    checks: Object.freeze(checks.map((check) => Object.freeze(check))),
    attentionDocuments: Object.freeze({
      unissued: Object.freeze(unissuedDocuments.map((document) => document.taxDocumentId)),
      missingDocumentNumber: Object.freeze(missingDocumentNumber.map((document) => document.taxDocumentId)),
      unlinkedSource: Object.freeze(unlinkedSourceDocuments.map((document) => document.taxDocumentId)),
      missingCounterpartyTaxId: Object.freeze(missingCounterpartyTaxId.map((document) => document.taxDocumentId)),
      negativeAmount: Object.freeze(negativeAmountDocuments.map((document) => document.taxDocumentId)),
      nonThbCurrency: Object.freeze(nonThbDocuments.map((document) => document.taxDocumentId)),
      cancelled: Object.freeze(cancelledDocuments.map((document) => document.taxDocumentId)),
    }),
  });
};

module.exports = Object.freeze({ buildOutputTaxPeriodReadiness });
