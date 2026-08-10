'use strict';

const { prisma, Prisma } = require('../../../../lib/prisma');
const accountingOfficeService = require('../accountingOffice/accountingOfficePackageService');

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const positiveBranchId = (value) => {
  const branchId = Number(value);
  if (!Number.isInteger(branchId) || branchId <= 0) fail('VAT_SETTLEMENT_BRANCH_REQUIRED', 'branchId must be a positive integer');
  return branchId;
};

const requirePeriodId = (value) => {
  const taxPeriodId = String(value || '').trim();
  if (!taxPeriodId) fail('VAT_SETTLEMENT_PERIOD_REQUIRED', 'taxPeriodId is required');
  return taxPeriodId;
};

const amount = (value) => Number(Number(value || 0).toFixed(2));

const loadVatSettlementPreparation = async ({ branchId, taxPeriodId }, tx = prisma) => {
  const normalizedBranchId = positiveBranchId(branchId);
  const normalizedPeriodId = requirePeriodId(taxPeriodId);
  const closingPackage = await accountingOfficeService.loadAccountingOfficePackage({
    branchId: normalizedBranchId,
    taxPeriodId: normalizedPeriodId,
  }, tx);

  const period = closingPackage.period;
  const year = new Date(period.startDate).getUTCFullYear();
  const month = new Date(period.startDate).getUTCMonth() + 1;

  const outputFilingRows = await tx.$queryRaw(Prisma.sql`
    SELECT
      batch."id" AS "batchId",
      batch."status" AS "batchStatus",
      COUNT(item."id") FILTER (WHERE item."status" <> 'REMOVED'::"SalesTaxFilingItemStatus")::int AS "itemCount",
      COALESCE(SUM(
        CASE
          WHEN record."ledgerType" = 'OUTPUT_VAT_ADJUSTMENT'::"TaxLedgerType"
            THEN -record."taxAmount"
          ELSE record."taxAmount"
        END
      ) FILTER (WHERE item."status" <> 'REMOVED'::"SalesTaxFilingItemStatus"), 0) AS "netVatAmount"
    FROM "SalesTaxFilingBatch" batch
    LEFT JOIN "SalesTaxFilingItem" item ON item."batchId" = batch."id"
    LEFT JOIN "OutputVatRecord" record
      ON record."taxDocumentId" = item."taxDocumentId"
     AND record."branchId" = batch."branchId"
    WHERE batch."branchId" = ${normalizedBranchId}
      AND batch."year" = ${year}
      AND batch."month" = ${month}
      AND batch."status" <> 'VOIDED'::"SalesTaxFilingStatus"
    GROUP BY batch."id"
    ORDER BY batch."id" DESC
    LIMIT 1
  `);

  const inputFilingRows = await tx.$queryRaw(Prisma.sql`
    SELECT
      batch."id" AS "batchId",
      batch."status" AS "batchStatus",
      COUNT(item."id") FILTER (
        WHERE item."status" IN ('SELECTED'::"InputTaxFilingItemStatus", 'FILED'::"InputTaxFilingItemStatus")
      )::int AS "itemCount",
      COALESCE(SUM(
        CASE
          WHEN COALESCE(item."documentSnapshot"->>'inputVatLedgerType', '') = 'INPUT_VAT_ADJUSTMENT'
            THEN -COALESCE(item."claimedVatAmount", 0)
          ELSE COALESCE(item."claimedVatAmount", 0)
        END
      ) FILTER (
        WHERE item."status" IN ('SELECTED'::"InputTaxFilingItemStatus", 'FILED'::"InputTaxFilingItemStatus")
      ), 0) AS "creditableVatAmount"
    FROM "InputTaxFilingBatch" batch
    LEFT JOIN "InputTaxFilingItem" item ON item."batchId" = batch."id"
    WHERE batch."branchId" = ${normalizedBranchId}
      AND batch."year" = ${year}
      AND batch."month" = ${month}
      AND batch."status" <> 'VOIDED'::"InputTaxFilingStatus"
    GROUP BY batch."id"
    ORDER BY batch."id" DESC
    LIMIT 1
  `);

  const outputFiling = outputFilingRows[0] || null;
  const inputFiling = inputFilingRows[0] || null;
  const outputVatAuthority = amount(closingPackage.summary?.taxAmount);
  const outputVatFiling = amount(outputFiling?.netVatAmount);
  const creditableInputVat = amount(inputFiling?.creditableVatAmount);
  const rawInputVat = amount(closingPackage.inputSummary?.taxAmount);
  const nonCreditableOrUnselectedInputVat = amount(Math.max(0, rawInputVat - creditableInputVat));
  const netVat = amount(outputVatAuthority - creditableInputVat);
  const vatPayable = amount(Math.max(0, netVat));
  const vatCredit = amount(Math.max(0, -netVat));
  const outputReconciliationDifference = amount(outputVatAuthority - outputVatFiling);

  const readiness = Object.freeze({
    outputFilingPrepared: Boolean(outputFiling),
    inputFilingPrepared: Boolean(inputFiling),
    outputFilingReconciled: Boolean(outputFiling) && Math.abs(outputReconciliationDifference) < 0.005,
    inputCreditAuthorityReady: Boolean(inputFiling) && closingPackage.readiness.inputVatReady,
    periodLockedOrSubmitted: closingPackage.readiness.periodLockedOrSubmitted,
  });

  const exceptions = [];
  if (!readiness.outputFilingPrepared) exceptions.push({ code: 'VAT_SETTLEMENT_OUTPUT_FILING_NOT_PREPARED', source: 'OUTPUT_VAT', severity: 'BLOCKER' });
  if (!readiness.inputFilingPrepared) exceptions.push({ code: 'VAT_SETTLEMENT_INPUT_FILING_NOT_PREPARED', source: 'INPUT_VAT', severity: 'BLOCKER' });
  if (readiness.outputFilingPrepared && !readiness.outputFilingReconciled) exceptions.push({ code: 'VAT_SETTLEMENT_OUTPUT_RECONCILIATION_MISMATCH', source: 'OUTPUT_VAT', severity: 'BLOCKER', amount: outputReconciliationDifference });
  if (readiness.inputFilingPrepared && !readiness.inputCreditAuthorityReady) exceptions.push({ code: 'VAT_SETTLEMENT_INPUT_CREDIT_NOT_READY', source: 'INPUT_VAT', severity: 'BLOCKER' });
  if (!readiness.periodLockedOrSubmitted) exceptions.push({ code: 'VAT_SETTLEMENT_PERIOD_NOT_LOCKED', source: 'TAX_PERIOD', severity: 'BLOCKER' });

  return Object.freeze({
    authority: 'VAT_SETTLEMENT_PREPARATION',
    purpose: 'PP30_PREPARATION',
    branchId: normalizedBranchId,
    period,
    outputFiling: outputFiling ? { id: Number(outputFiling.batchId), status: outputFiling.batchStatus, itemCount: Number(outputFiling.itemCount || 0) } : null,
    inputFiling: inputFiling ? { id: Number(inputFiling.batchId), status: inputFiling.batchStatus, itemCount: Number(inputFiling.itemCount || 0) } : null,
    settlement: Object.freeze({
      outputVatAuthority,
      outputVatFiling,
      creditableInputVat,
      rawInputVat,
      nonCreditableOrUnselectedInputVat,
      netVat,
      vatPayable,
      vatCredit,
      outputReconciliationDifference,
    }),
    readiness: Object.freeze({
      ...readiness,
      readyForPp30Preparation: exceptions.length === 0,
    }),
    exceptions: Object.freeze(exceptions),
  });
};

module.exports = Object.freeze({ loadVatSettlementPreparation });
