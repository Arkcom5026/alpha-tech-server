'use strict';

const { prisma, Prisma } = require('../../../../lib/prisma');

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const positiveBranchId = (value) => {
  const branchId = Number(value);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    fail('ACCOUNTING_OFFICE_BRANCH_REQUIRED', 'branchId must be a positive integer');
  }
  return branchId;
};

const requirePeriodId = (value) => {
  const taxPeriodId = String(value || '').trim();
  if (!taxPeriodId) fail('ACCOUNTING_OFFICE_PERIOD_REQUIRED', 'taxPeriodId is required');
  return taxPeriodId;
};

const decimalNumber = (value) => Number(value || 0);

const loadAccountingOfficePackage = async ({ branchId, taxPeriodId }, tx = prisma) => {
  const normalizedBranchId = positiveBranchId(branchId);
  const normalizedPeriodId = requirePeriodId(taxPeriodId);

  const periods = await tx.$queryRaw(Prisma.sql`
    SELECT *
    FROM "TaxPeriod"
    WHERE "id" = ${normalizedPeriodId}
      AND "branchId" = ${normalizedBranchId}
    LIMIT 1
  `);
  const period = periods[0];
  if (!period) fail('ACCOUNTING_OFFICE_PERIOD_NOT_FOUND', 'Tax period not found', 404);

  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      record."id" AS "outputVatRecordId",
      record."taxDocumentId",
      record."ledgerType",
      record."documentType",
      record."taxInvoiceKind",
      record."issuedDocumentNumber",
      record."documentDate",
      record."currency",
      record."subtotalAmount",
      record."taxAmount",
      record."totalAmount",
      record."counterpartyName",
      record."counterpartyTaxId",
      record."counterpartyBranchCode",
      record."originalTaxDocumentId",
      record."originalDocumentNumber",
      document."status" AS "taxDocumentStatus"
    FROM "OutputVatRecord" record
    JOIN "TaxDocument" document
      ON document."id" = record."taxDocumentId"
     AND document."branchId" = record."branchId"
    WHERE record."branchId" = ${normalizedBranchId}
      AND record."ledgerType" IN (
        'OUTPUT_VAT'::"TaxLedgerType",
        'OUTPUT_VAT_ADJUSTMENT'::"TaxLedgerType"
      )
      AND record."documentDate" >= ${period.startDate}
      AND record."documentDate" <= ${period.endDate}
      AND (record."taxPeriodId" IS NULL OR record."taxPeriodId" = ${normalizedPeriodId})
      AND document."status" IN ('REGISTERED', 'UNDER_REVIEW', 'APPROVED')
    ORDER BY record."documentDate" ASC, record."issuedDocumentNumber" ASC, record."taxDocumentId" ASC
  `);

  const filingBatches = await tx.$queryRaw(Prisma.sql`
    SELECT batch.*,
      COUNT(item."id") FILTER (WHERE item."status" <> 'REMOVED'::"SalesTaxFilingItemStatus")::int AS "itemCount"
    FROM "SalesTaxFilingBatch" batch
    LEFT JOIN "SalesTaxFilingItem" item ON item."batchId" = batch."id"
    WHERE batch."branchId" = ${normalizedBranchId}
      AND batch."year" = ${new Date(period.startDate).getUTCFullYear()}
      AND batch."month" = ${new Date(period.startDate).getUTCMonth() + 1}
    GROUP BY batch."id"
    ORDER BY batch."id" DESC
  `);
  const latestFiling = filingBatches[0] || null;

  const documents = rows.map((row) => {
    const sign = row.ledgerType === 'OUTPUT_VAT_ADJUSTMENT' ? -1 : 1;
    return {
      ...row,
      subtotalAmount: sign * decimalNumber(row.subtotalAmount),
      taxAmount: sign * decimalNumber(row.taxAmount),
      totalAmount: sign * decimalNumber(row.totalAmount),
    };
  });

  const summary = documents.reduce((acc, document) => {
    acc.documentCount += 1;
    if (document.ledgerType === 'OUTPUT_VAT_ADJUSTMENT') acc.adjustmentCount += 1;
    else acc.invoiceCount += 1;
    acc.subtotalAmount += document.subtotalAmount;
    acc.taxAmount += document.taxAmount;
    acc.totalAmount += document.totalAmount;
    return acc;
  }, {
    documentCount: 0,
    invoiceCount: 0,
    adjustmentCount: 0,
    subtotalAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
  });

  const unboundCount = rows.filter((row) => !row.taxPeriodId).length;
  const filingItemCount = Number(latestFiling?.itemCount || 0);
  const readiness = {
    outputVatComplete: unboundCount === 0,
    filingPrepared: Boolean(latestFiling),
    filingSubmitted: latestFiling?.status === 'SUBMITTED',
    filingCoversAllDocuments: Boolean(latestFiling) && filingItemCount === rows.length,
    periodClosedOrLater: ['CLOSED', 'LOCKED', 'SUBMITTED'].includes(period.status),
    periodLockedOrSubmitted: ['LOCKED', 'SUBMITTED'].includes(period.status),
  };
  readiness.readyForAccountingOffice = readiness.outputVatComplete
    && readiness.filingPrepared
    && readiness.filingCoversAllDocuments
    && readiness.periodLockedOrSubmitted;

  return Object.freeze({
    authority: 'OUTPUT_VAT_RECORD',
    branchId: normalizedBranchId,
    period,
    filing: latestFiling,
    summary,
    readiness,
    documents,
  });
};

module.exports = Object.freeze({ loadAccountingOfficePackage });
