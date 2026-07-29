'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');
const outputTaxPeriodRepository = require('../period/repository/outputTaxPeriodRepository');

const normalizePositiveInt = (value, code, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), { code, statusCode: 400 });
  }
  return parsed;
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

const amount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const startOfMonthUtc = (year, month) => new Date(Date.UTC(year, month - 1, 1));
const startOfNextMonthUtc = (year, month) => new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1));

const buildOutputTaxPeriodReport = async ({ branchId, year, month }) => {
  const normalizedBranchId = normalizePositiveInt(branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const normalizedYear = normalizeYear(year);
  const normalizedMonth = normalizeMonth(month);
  const periodStart = startOfMonthUtc(normalizedYear, normalizedMonth);
  const periodEndExclusive = startOfNextMonthUtc(normalizedYear, normalizedMonth);

  const [rows, period] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`
      SELECT
        document."id",
        document."documentType",
        document."documentNumber",
        document."status",
        document."issuedAt",
        document."occurredAt",
        document."counterpartyTaxId",
        document."currency",
        document."subtotalAmount",
        document."taxAmount",
        document."totalAmount",
        document."snapshot",
        candidate."sourceType",
        candidate."sourceId",
        candidate."sourceDocumentNo"
      FROM "TaxDocument" document
      LEFT JOIN "TaxCandidate" candidate ON candidate."id" = document."candidateId"
      WHERE document."branchId" = ${normalizedBranchId}
        AND document."documentType" LIKE 'OUTPUT_%'
        AND document."issuedAt" >= ${periodStart}
        AND document."issuedAt" < ${periodEndExclusive}
      ORDER BY document."issuedAt" ASC, document."id" ASC
    `),
    outputTaxPeriodRepository.findByBranchYearMonth({
      branchId: normalizedBranchId,
      year: normalizedYear,
      month: normalizedMonth,
    }),
  ]);

  const documents = rows.map((row) => {
    const snapshot = row.snapshot || {};
    const counterparty = snapshot.counterparty || {};
    return Object.freeze({
      taxDocumentId: Number(row.id),
      documentType: row.documentType,
      documentNumber: row.documentNumber,
      status: row.status,
      issuedAt: row.issuedAt,
      occurredAt: row.occurredAt,
      currency: row.currency || 'THB',
      counterpartyName:
        counterparty.displayName || counterparty.companyName || counterparty.name || null,
      counterpartyTaxId: row.counterpartyTaxId || counterparty.taxId || null,
      sourceType: row.sourceType || null,
      sourceId: row.sourceId || null,
      sourceDocumentNo: row.sourceDocumentNo || null,
      subtotalAmount: amount(row.subtotalAmount),
      taxAmount: amount(row.taxAmount),
      totalAmount: amount(row.totalAmount),
      isCancelled: String(row.status || '').toUpperCase() === 'CANCELLED',
      replacementOf: snapshot.replacementOf || null,
    });
  });

  const activeDocuments = documents.filter((document) => !document.isCancelled);
  const cancelledDocuments = documents.filter((document) => document.isCancelled);
  const totals = activeDocuments.reduce(
    (summary, document) => {
      summary.subtotalAmount += document.subtotalAmount;
      summary.taxAmount += document.taxAmount;
      summary.totalAmount += document.totalAmount;
      return summary;
    },
    { subtotalAmount: 0, taxAmount: 0, totalAmount: 0 },
  );

  const byDocumentType = Object.freeze(
    activeDocuments.reduce((summary, document) => {
      const key = document.documentType || 'UNKNOWN';
      const current = summary[key] || { documentCount: 0, subtotalAmount: 0, taxAmount: 0, totalAmount: 0 };
      summary[key] = {
        documentCount: current.documentCount + 1,
        subtotalAmount: current.subtotalAmount + document.subtotalAmount,
        taxAmount: current.taxAmount + document.taxAmount,
        totalAmount: current.totalAmount + document.totalAmount,
      };
      return summary;
    }, {}),
  );

  const authority = Object.freeze({
    periodExists: Boolean(period),
    periodId: period?.id || null,
    status: period?.status || null,
    version: period?.version || null,
    lockedForTaxWrites: Boolean(period && ['CLOSING', 'CLOSED'].includes(period.status)),
    closeRequestedAt: period?.closeRequestedAt || null,
    closedAt: period?.closedAt || null,
    reopenedAt: period?.reopenedAt || null,
  });

  return Object.freeze({
    schemaVersion: 'OUTPUT_TAX_PERIOD_REPORT_V2',
    branchId: normalizedBranchId,
    year: normalizedYear,
    month: normalizedMonth,
    periodStart: periodStart.toISOString(),
    periodEndExclusive: periodEndExclusive.toISOString(),
    currency: activeDocuments[0]?.currency || documents[0]?.currency || period?.currency || 'THB',
    documentCount: documents.length,
    activeDocumentCount: activeDocuments.length,
    cancelledDocumentCount: cancelledDocuments.length,
    totals: Object.freeze(totals),
    byDocumentType,
    authority,
    documents: Object.freeze(documents),
  });
};

module.exports = Object.freeze({ buildOutputTaxPeriodReport });