'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const mapBatch = (row) => row && ({
  ...row,
  id: Number(row.id),
  branchId: Number(row.branchId),
  year: Number(row.year),
  month: Number(row.month),
  createdById: Number(row.createdById),
});

const findPeriod = async ({ branchId, taxPeriodId }, tx = prisma, { forUpdate = false } = {}) => {
  const lock = forUpdate ? Prisma.sql`FOR UPDATE` : Prisma.empty;
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT "id", "branchId", "periodCode", "startDate", "endDate", "status"
    FROM "TaxPeriod"
    WHERE "id" = ${String(taxPeriodId)}
      AND "branchId" = ${Number(branchId)}
    LIMIT 1
    ${lock}
  `);
  const row = rows[0];
  return row ? {
    ...row,
    branchId: Number(row.branchId),
  } : null;
};

const acquirePeriodPreparationLock = async ({ branchId, year, month }, tx = prisma) => {
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(${Number(branchId)}, ${Number(year) * 100 + Number(month)})
  `);
};

const findLatestActiveBatch = async ({ branchId, year, month }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT *
    FROM "InputTaxFilingBatch"
    WHERE "branchId" = ${Number(branchId)}
      AND "year" = ${Number(year)}
      AND "month" = ${Number(month)}
      AND "status" <> 'VOIDED'::"InputTaxFilingStatus"
    ORDER BY "id" DESC
    LIMIT 1
  `);
  return mapBatch(rows[0]);
};

const createDraftBatch = async ({ branchId, year, month, createdById }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "InputTaxFilingBatch" (
      "branchId", "year", "month", "status", "createdById", "createdAt", "updatedAt"
    ) VALUES (
      ${Number(branchId)}, ${Number(year)}, ${Number(month)},
      'DRAFT'::"InputTaxFilingStatus", ${Number(createdById)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING *
  `);
  return mapBatch(rows[0]);
};

const listBatchItems = async ({ batchId }, tx = prisma) => {
  if (!batchId) return [];
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      "id", "batchId", "taxDocumentId", "status",
      "claimedSubtotalAmount", "claimedVatAmount", "claimedTotalAmount",
      "selectedAt", "filedAt", "removedAt", "removedReason", "version"
    FROM "InputTaxFilingItem"
    WHERE "batchId" = ${Number(batchId)}
    ORDER BY "id" ASC
  `);
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    batchId: Number(row.batchId),
    taxDocumentId: row.taxDocumentId == null ? null : Number(row.taxDocumentId),
    claimedSubtotalAmount: Number(row.claimedSubtotalAmount || 0),
    claimedVatAmount: Number(row.claimedVatAmount || 0),
    claimedTotalAmount: Number(row.claimedTotalAmount || 0),
    version: Number(row.version || 1),
  }));
};

const listPeriodInputVatAuthorities = async ({ branchId, taxPeriodId, startDate, endDate }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      record."id" AS "inputVatRecordId",
      record."taxDocumentId",
      record."ledgerType",
      record."documentNumber",
      record."documentDate",
      record."subtotalAmount",
      record."taxAmount",
      record."totalAmount",
      record."currency"
    FROM "InputVatRecord" record
    WHERE record."branchId" = ${Number(branchId)}
      AND record."ledgerType" IN (
        'INPUT_VAT'::"TaxLedgerType",
        'INPUT_VAT_ADJUSTMENT'::"TaxLedgerType"
      )
      AND record."documentDate" >= ${startDate}
      AND record."documentDate" <= ${endDate}
      AND (record."taxPeriodId" IS NULL OR record."taxPeriodId" = ${String(taxPeriodId)})
    ORDER BY record."documentDate" ASC, record."documentNumber" ASC, record."taxDocumentId" ASC
  `);
  return rows.map((row) => ({
    ...row,
    inputVatRecordId: String(row.inputVatRecordId),
    taxDocumentId: Number(row.taxDocumentId),
    subtotalAmount: Number(row.subtotalAmount || 0),
    taxAmount: Number(row.taxAmount || 0),
    totalAmount: Number(row.totalAmount || 0),
    currency: row.currency || 'THB',
  }));
};

module.exports = Object.freeze({
  acquirePeriodPreparationLock,
  createDraftBatch,
  findLatestActiveBatch,
  findPeriod,
  listBatchItems,
  listPeriodInputVatAuthorities,
});
