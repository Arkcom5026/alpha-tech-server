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

const sumAmounts = (rows, amountFields) => rows.reduce((summary, row) => {
  amountFields.forEach((field) => {
    summary[field] += decimalNumber(row[field]);
  });
  return summary;
}, Object.fromEntries(amountFields.map((field) => [field, 0])));

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

  const year = new Date(period.startDate).getUTCFullYear();
  const month = new Date(period.startDate).getUTCMonth() + 1;

  const outputRows = await tx.$queryRaw(Prisma.sql`
    SELECT
      record."id" AS "outputVatRecordId",
      record."taxDocumentId",
      record."taxPeriodId",
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

  const outputFilingBatches = await tx.$queryRaw(Prisma.sql`
    SELECT batch.*,
      COUNT(item."id") FILTER (WHERE item."status" <> 'REMOVED'::"SalesTaxFilingItemStatus")::int AS "itemCount"
    FROM "SalesTaxFilingBatch" batch
    LEFT JOIN "SalesTaxFilingItem" item ON item."batchId" = batch."id"
    WHERE batch."branchId" = ${normalizedBranchId}
      AND batch."year" = ${year}
      AND batch."month" = ${month}
      AND batch."status" <> 'VOIDED'::"SalesTaxFilingStatus"
    GROUP BY batch."id"
    ORDER BY batch."id" DESC
  `);
  const latestOutputFiling = outputFilingBatches[0] || null;

  const inputRows = await tx.$queryRaw(Prisma.sql`
    SELECT
      record."id" AS "inputVatRecordId",
      record."taxDocumentId",
      record."taxPeriodId",
      record."ledgerType",
      record."documentType",
      document."taxInvoiceKind" AS "taxInvoiceKind",
      COALESCE(document."issuedDocumentNumber", record."documentNumber") AS "issuedDocumentNumber",
      record."documentDate",
      record."currency",
      record."subtotalAmount",
      record."taxAmount",
      record."totalAmount",
      record."supplierName" AS "counterpartyName",
      record."supplierTaxId" AS "counterpartyTaxId",
      record."supplierBranchCode" AS "counterpartyBranchCode",
      record."originalTaxDocumentId",
      record."originalDocumentNumber",
      document."status" AS "taxDocumentStatus"
    FROM "InputVatRecord" record
    JOIN "TaxDocument" document
      ON document."id" = record."taxDocumentId"
     AND document."branchId" = record."branchId"
    WHERE record."branchId" = ${normalizedBranchId}
      AND record."ledgerType" IN (
        'INPUT_VAT'::"TaxLedgerType",
        'INPUT_VAT_ADJUSTMENT'::"TaxLedgerType"
      )
      AND record."documentDate" >= ${period.startDate}
      AND record."documentDate" <= ${period.endDate}
      AND (record."taxPeriodId" IS NULL OR record."taxPeriodId" = ${normalizedPeriodId})
    ORDER BY record."documentDate" ASC, record."documentNumber" ASC, record."taxDocumentId" ASC
  `);

  const inputFilingBatches = await tx.$queryRaw(Prisma.sql`
    SELECT batch.*,
      COUNT(item."id") FILTER (
        WHERE item."status" IN (
          'SELECTED'::"InputTaxFilingItemStatus",
          'FILED'::"InputTaxFilingItemStatus"
        )
      )::int AS "itemCount"
    FROM "InputTaxFilingBatch" batch
    LEFT JOIN "InputTaxFilingItem" item ON item."batchId" = batch."id"
    WHERE batch."branchId" = ${normalizedBranchId}
      AND batch."year" = ${year}
      AND batch."month" = ${month}
      AND batch."status" <> 'VOIDED'::"InputTaxFilingStatus"
    GROUP BY batch."id"
    ORDER BY batch."id" DESC
  `);
  const latestInputFiling = inputFilingBatches[0] || null;

  const expenseRows = await tx.$queryRaw(Prisma.sql`
    SELECT
      expense."id",
      expense."expenseNumber",
      expense."counterpartyName",
      expense."counterpartyTaxId",
      expense."documentNumber",
      expense."documentDate",
      expense."expenseDate",
      expense."status",
      expense."evidenceStatus",
      expense."subtotalAmount",
      expense."vatAmount",
      expense."totalAmount",
      expense."withholdingTaxAmount",
      expense."paymentDueAmount",
      COUNT(item."id")::int AS "itemCount",
      COUNT(item."id") FILTER (
        WHERE item."vatTreatment" = 'PENDING_REVIEW'::"TaxExpenseVatTreatment"
           OR item."citTreatment" = 'PENDING_REVIEW'::"TaxExpenseCitTreatment"
           OR item."whtTreatment" = 'PENDING_REVIEW'::"TaxExpenseWhtTreatment"
      )::int AS "pendingAssessmentItemCount",
      COUNT(item."id") FILTER (
        WHERE item."whtTreatment" = 'WITHHOLDING_REQUIRED'::"TaxExpenseWhtTreatment"
      )::int AS "withholdingRequiredItemCount",
      COUNT(item."id") FILTER (
        WHERE item."whtTreatment" = 'WITHHELD'::"TaxExpenseWhtTreatment"
      )::int AS "withheldItemCount",
      EXISTS (
        SELECT 1
        FROM "TaxExpenseAttachment" attachment
        WHERE attachment."taxExpenseId" = expense."id"
          AND attachment."attachmentType" = 'WITHHOLDING_CERTIFICATE'::"TaxExpenseAttachmentType"
          AND attachment."evidenceStatus" = 'VERIFIED'::"TaxExpenseEvidenceStatus"
      ) AS "hasVerifiedWithholdingCertificate"
    FROM "TaxExpense" expense
    LEFT JOIN "TaxExpenseItem" item
      ON item."taxExpenseId" = expense."id"
     AND item."branchId" = expense."branchId"
    WHERE expense."branchId" = ${normalizedBranchId}
      AND expense."expenseDate" >= ${period.startDate}
      AND expense."expenseDate" <= ${period.endDate}
      AND expense."status" <> 'VOIDED'::"TaxExpenseStatus"
    GROUP BY expense."id"
    ORDER BY expense."expenseDate" ASC, expense."expenseNumber" ASC, expense."id" ASC
  `);

  const documents = outputRows.map((row) => {
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

  const inputDocuments = inputRows.map((row) => {
    const sign = row.ledgerType === 'INPUT_VAT_ADJUSTMENT' ? -1 : 1;
    return {
      ...row,
      subtotalAmount: sign * decimalNumber(row.subtotalAmount),
      taxAmount: sign * decimalNumber(row.taxAmount),
      totalAmount: sign * decimalNumber(row.totalAmount),
    };
  });
  const inputAmountTotals = sumAmounts(inputDocuments, ['subtotalAmount', 'taxAmount', 'totalAmount']);
  const inputSummary = {
    documentCount: inputDocuments.length,
    adjustmentCount: inputDocuments.filter((row) => row.ledgerType === 'INPUT_VAT_ADJUSTMENT').length,
    ...inputAmountTotals,
  };

  const expenses = expenseRows.map((row) => ({
    ...row,
    subtotalAmount: decimalNumber(row.subtotalAmount),
    vatAmount: decimalNumber(row.vatAmount),
    totalAmount: decimalNumber(row.totalAmount),
    withholdingTaxAmount: decimalNumber(row.withholdingTaxAmount),
    paymentDueAmount: decimalNumber(row.paymentDueAmount),
    itemCount: Number(row.itemCount || 0),
    pendingAssessmentItemCount: Number(row.pendingAssessmentItemCount || 0),
    withholdingRequiredItemCount: Number(row.withholdingRequiredItemCount || 0),
    withheldItemCount: Number(row.withheldItemCount || 0),
    hasVerifiedWithholdingCertificate: Boolean(row.hasVerifiedWithholdingCertificate),
  }));
  const expenseAmountTotals = sumAmounts(expenses, [
    'subtotalAmount',
    'vatAmount',
    'totalAmount',
    'withholdingTaxAmount',
    'paymentDueAmount',
  ]);
  const expenseSummary = {
    expenseCount: expenses.length,
    pendingAssessmentCount: expenses.filter((row) => row.pendingAssessmentItemCount > 0).length,
    missingEvidenceCount: expenses.filter((row) => row.evidenceStatus !== 'VERIFIED').length,
    withholdingPendingCount: expenses.filter((row) => row.withholdingRequiredItemCount > 0).length,
    missingWithholdingCertificateCount: expenses.filter((row) => (
      row.withholdingTaxAmount > 0 && !row.hasVerifiedWithholdingCertificate
    )).length,
    ...expenseAmountTotals,
  };

  const outputUnboundCount = outputRows.filter((row) => !row.taxPeriodId).length;
  const inputUnboundCount = inputRows.filter((row) => !row.taxPeriodId).length;
  const outputFilingItemCount = Number(latestOutputFiling?.itemCount || 0);
  const inputFilingItemCount = Number(latestInputFiling?.itemCount || 0);

  const readiness = {
    outputVatComplete: outputUnboundCount === 0,
    filingPrepared: Boolean(latestOutputFiling),
    filingSubmitted: latestOutputFiling?.status === 'SUBMITTED',
    filingCoversAllDocuments: Boolean(latestOutputFiling) && outputFilingItemCount === outputRows.length,
    inputVatComplete: inputUnboundCount === 0,
    inputFilingPrepared: Boolean(latestInputFiling),
    inputFilingSubmitted: latestInputFiling?.status === 'SUBMITTED',
    inputFilingCoversAllDocuments: Boolean(latestInputFiling) && inputFilingItemCount === inputRows.length,
    expensesClassified: expenseSummary.pendingAssessmentCount === 0,
    expenseEvidenceComplete: expenseSummary.missingEvidenceCount === 0,
    withholdingComplete: expenseSummary.withholdingPendingCount === 0,
    withholdingEvidenceComplete: expenseSummary.missingWithholdingCertificateCount === 0,
    periodClosedOrLater: ['CLOSED', 'LOCKED', 'SUBMITTED'].includes(period.status),
    periodLockedOrSubmitted: ['LOCKED', 'SUBMITTED'].includes(period.status),
  };
  readiness.outputVatReady = readiness.outputVatComplete
    && readiness.filingPrepared
    && readiness.filingCoversAllDocuments;
  readiness.inputVatReady = readiness.inputVatComplete
    && readiness.inputFilingPrepared
    && readiness.inputFilingCoversAllDocuments;
  readiness.expensesReady = readiness.expensesClassified && readiness.expenseEvidenceComplete;
  readiness.withholdingReady = readiness.withholdingComplete && readiness.withholdingEvidenceComplete;
  readiness.readyForAccountingOffice = readiness.outputVatReady
    && readiness.inputVatReady
    && readiness.expensesReady
    && readiness.withholdingReady
    && readiness.periodLockedOrSubmitted;

  return Object.freeze({
    authority: 'MONTHLY_TAX_CLOSING_PACKAGE',
    authorities: Object.freeze({
      outputVat: 'OUTPUT_VAT_RECORD',
      inputVat: 'INPUT_VAT_RECORD',
      expenses: 'TAX_EXPENSE',
      withholding: 'TAX_EXPENSE_WHT_TREATMENT_AND_EVIDENCE',
      period: 'TAX_PERIOD',
    }),
    branchId: normalizedBranchId,
    period,
    filing: latestOutputFiling,
    inputFiling: latestInputFiling,
    summary,
    inputSummary,
    expenseSummary,
    readiness,
    documents,
    inputDocuments,
    expenses,
  });
};

module.exports = Object.freeze({ loadAccountingOfficePackage });
