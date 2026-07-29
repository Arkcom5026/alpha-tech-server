'use strict';

const { buildOutputTaxPeriodReadiness } = require('../readiness/buildOutputTaxPeriodReadinessService');
const { buildOutputTaxPeriodReport } = require('../reporting/buildOutputTaxPeriodReportService');
const outputTaxPeriodRepository = require('../period/repository/outputTaxPeriodRepository');

const normalizePositiveInt = (value, code, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), { code, statusCode: 400 });
  }
  return parsed;
};

const normalizeYear = (value) => {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2200) {
    throw Object.assign(new Error('year must be an integer between 2000 and 2200'), {
      code: 'OUTPUT_TAX_PERIOD_YEAR_INVALID',
      statusCode: 400,
    });
  }
  return year;
};

const normalizeMonth = (value) => {
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw Object.assign(new Error('month must be an integer between 1 and 12'), {
      code: 'OUTPUT_TAX_PERIOD_MONTH_INVALID',
      statusCode: 400,
    });
  }
  return month;
};

const buildOutputTaxPeriodClosingPlan = async ({ branchId, year, month }) => {
  const normalizedBranchId = normalizePositiveInt(branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const normalizedYear = normalizeYear(year);
  const normalizedMonth = normalizeMonth(month);

  const [report, readiness, period] = await Promise.all([
    buildOutputTaxPeriodReport({
      branchId: normalizedBranchId,
      year: normalizedYear,
      month: normalizedMonth,
    }),
    buildOutputTaxPeriodReadiness({
      branchId: normalizedBranchId,
      year: normalizedYear,
      month: normalizedMonth,
    }),
    outputTaxPeriodRepository.findByBranchYearMonth({
      branchId: normalizedBranchId,
      year: normalizedYear,
      month: normalizedMonth,
    }),
  ]);

  const activeDocuments = report.documents.filter((document) => !document.isCancelled);
  const cancelledDocuments = report.documents.filter((document) => document.isCancelled);
  const activeTaxDocumentIds = activeDocuments.map((document) => document.taxDocumentId);
  const cancelledTaxDocumentIds = cancelledDocuments.map((document) => document.taxDocumentId);
  const periodExists = Boolean(period);
  const closeRequestAllowed = periodExists && ['OPEN', 'REOPENED'].includes(period.status);
  const closeAllowed = periodExists && period.status === 'CLOSING' && readiness.readyForFiling;
  const reopenAllowed = periodExists && period.status === 'CLOSED';

  const commands = Object.freeze([
    Object.freeze({
      step: 1,
      code: 'REVIEW_BLOCKING_FAILURES',
      required: readiness.blockingFailureCount > 0,
      completed: readiness.blockingFailureCount === 0,
      documentIds: Object.freeze([
        ...new Set(Object.values(readiness.attentionDocuments || {}).flat()),
      ]),
    }),
    Object.freeze({
      step: 2,
      code: 'REVIEW_CANCELLATIONS_AND_REPLACEMENTS',
      required: cancelledDocuments.length > 0,
      completed: cancelledDocuments.length === 0,
      documentIds: Object.freeze(cancelledTaxDocumentIds),
    }),
    Object.freeze({
      step: 3,
      code: 'RECONCILE_OUTPUT_TAX_TOTALS',
      required: true,
      completed: readiness.readyForFiling,
      expectedTotals: Object.freeze({ ...report.totals }),
      documentIds: Object.freeze(activeTaxDocumentIds),
    }),
    Object.freeze({
      step: 4,
      code: 'AUTHORIZE_PERIOD_CLOSE',
      required: true,
      completed: period?.status === 'CLOSED',
      requires: Object.freeze(['readyForFiling', 'authorizedActor', 'persistentCloseRecord']),
      action: !periodExists
        ? 'CREATE_PERIOD'
        : closeRequestAllowed
          ? 'REQUEST_CLOSE'
          : closeAllowed
            ? 'CLOSE_PERIOD'
            : reopenAllowed
              ? 'REOPEN_PERIOD'
              : 'NO_ACTION',
    }),
  ]);

  return Object.freeze({
    schemaVersion: 'OUTPUT_TAX_PERIOD_CLOSING_PLAN_V2',
    branchId: normalizedBranchId,
    period: Object.freeze({
      id: period?.id || null,
      year: report.year,
      month: report.month,
      status: period?.status || null,
      version: period?.version || null,
    }),
    readyForCloseAuthorization: readiness.readyForFiling,
    persistentCloseSupported: true,
    closeAuthorityImplemented: true,
    authority: Object.freeze({
      periodExists,
      closeRequestAllowed,
      closeAllowed,
      reopenAllowed,
      lockedForTaxWrites: periodExists && ['CLOSING', 'CLOSED'].includes(period.status),
    }),
    reportSummary: Object.freeze({
      documentCount: report.documentCount,
      activeDocumentCount: report.activeDocumentCount,
      cancelledDocumentCount: report.cancelledDocumentCount,
      totals: report.totals,
    }),
    readinessSummary: Object.freeze({
      readyForFiling: readiness.readyForFiling,
      blockingFailureCount: readiness.blockingFailureCount,
      warningCount: readiness.warningCount,
    }),
    commands,
    nextRequiredIncrement: !periodExists
      ? 'CREATE_OUTPUT_TAX_PERIOD'
      : closeRequestAllowed
        ? 'REQUEST_OUTPUT_TAX_PERIOD_CLOSE'
        : closeAllowed
          ? 'CLOSE_OUTPUT_TAX_PERIOD'
          : reopenAllowed
            ? 'OUTPUT_TAX_PERIOD_CLOSED'
            : readiness.readyForFiling
              ? 'REVIEW_OUTPUT_TAX_PERIOD_AUTHORITY_STATE'
              : 'RESOLVE_OUTPUT_TAX_PERIOD_READINESS_FAILURES',
  });
};

module.exports = Object.freeze({ buildOutputTaxPeriodClosingPlan });
