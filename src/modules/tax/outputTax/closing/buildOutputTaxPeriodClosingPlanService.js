'use strict';

const { buildOutputTaxPeriodReadiness } = require('../readiness/buildOutputTaxPeriodReadinessService');
const { buildOutputTaxPeriodReport } = require('../reporting/buildOutputTaxPeriodReportService');

const normalizePositiveInt = (value, code, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), { code, statusCode: 400 });
  }
  return parsed;
};

const buildOutputTaxPeriodClosingPlan = async ({ branchId, year, month }) => {
  const normalizedBranchId = normalizePositiveInt(branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const [report, readiness] = await Promise.all([
    buildOutputTaxPeriodReport({ branchId: normalizedBranchId, year, month }),
    buildOutputTaxPeriodReadiness({ branchId: normalizedBranchId, year, month }),
  ]);

  const activeDocuments = report.documents.filter((document) => !document.isCancelled);
  const cancelledDocuments = report.documents.filter((document) => document.isCancelled);
  const activeTaxDocumentIds = activeDocuments.map((document) => document.taxDocumentId);
  const cancelledTaxDocumentIds = cancelledDocuments.map((document) => document.taxDocumentId);

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
      completed: false,
      requires: Object.freeze(['readyForFiling', 'authorizedActor', 'persistentCloseRecord']),
    }),
  ]);

  return Object.freeze({
    schemaVersion: 'OUTPUT_TAX_PERIOD_CLOSING_PLAN_V1',
    branchId: normalizedBranchId,
    period: Object.freeze({ year: report.year, month: report.month }),
    readyForCloseAuthorization: readiness.readyForFiling,
    persistentCloseSupported: false,
    closeAuthorityImplemented: false,
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
    nextRequiredIncrement: readiness.readyForFiling
      ? 'PERSISTENT_OUTPUT_TAX_PERIOD_CLOSE_AUTHORITY'
      : 'RESOLVE_OUTPUT_TAX_PERIOD_READINESS_FAILURES',
  });
};

module.exports = Object.freeze({ buildOutputTaxPeriodClosingPlan });
