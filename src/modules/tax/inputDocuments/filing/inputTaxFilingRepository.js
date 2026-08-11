'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const filingTaxDocumentKey = (value) => Number(value);
const filingNumericAmount = (value) => String(value ?? 0);

const lockBatchPeriodAuthority = async ({ batchId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      batch."id" AS "batchId",
      batch."branchId",
      batch."year",
      batch."month",
      batch."status" AS "batchStatus",
      period."id" AS "taxPeriodId",
      period."status" AS "taxPeriodStatus"
    FROM "InputTaxFilingBatch" batch
    LEFT JOIN "TaxPeriod" period
      ON period."branchId" = batch."branchId"
      AND period."periodCode" = CONCAT(batch."year", '-', LPAD(batch."month"::text, 2, '0'))
    WHERE batch."id" = ${Number(batchId)}
    LIMIT 1
    FOR UPDATE OF batch
  `);
  return rows[0] || null;
};

const lockTaxDocumentForFiling = async ({ taxDocumentId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT "id", "branchId"
    FROM "TaxDocument"
    WHERE "id" = ${Number(taxDocumentId)}
    LIMIT 1
    FOR UPDATE
  `);
  return rows[0] || null;
};

const lockInputVatAuthorityForFiling = async ({ taxDocumentId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      "id",
      "branchId",
      "taxDocumentId",
      "ledgerType",
      "subtotalAmount",
      "taxAmount",
      "totalAmount",
      "documentNumber",
      "documentDate",
      "currency"
    FROM "InputVatRecord"
    WHERE "taxDocumentId" = ${Number(taxDocumentId)}
    LIMIT 1
    FOR UPDATE
  `);
  return rows[0] || null;
};

const findBatchDocumentItemForUpdate = async ({ batchId, taxDocumentId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT *
    FROM "InputTaxFilingItem"
    WHERE "batchId" = ${Number(batchId)}
      AND "taxDocumentId" = ${filingTaxDocumentKey(taxDocumentId)}
    LIMIT 1
    FOR UPDATE
  `);
  return rows[0] || null;
};

const selectDocumentForFiling = async ({
  batchId,
  taxDocumentId,
  claimedSubtotalAmount,
  claimedVatAmount,
  claimedTotalAmount,
  eligibilitySnapshot,
  documentSnapshot,
  selectedAt,
}, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "InputTaxFilingItem" (
      "batchId",
      "taxDocumentId",
      "status",
      "claimedSubtotalAmount",
      "claimedVatAmount",
      "claimedTotalAmount",
      "eligibilitySnapshot",
      "documentSnapshot",
      "selectedAt",
      "createdAt",
      "version"
    ) VALUES (
      ${Number(batchId)},
      ${filingTaxDocumentKey(taxDocumentId)},
      'SELECTED'::"InputTaxFilingItemStatus",
      ${filingNumericAmount(claimedSubtotalAmount)}::numeric,
      ${filingNumericAmount(claimedVatAmount)}::numeric,
      ${filingNumericAmount(claimedTotalAmount)}::numeric,
      ${JSON.stringify(eligibilitySnapshot)}::jsonb,
      ${JSON.stringify(documentSnapshot)}::jsonb,
      ${selectedAt},
      ${selectedAt},
      1
    )
    ON CONFLICT ("batchId", "taxDocumentId") WHERE "taxDocumentId" IS NOT NULL
    DO UPDATE SET
      "status" = 'SELECTED'::"InputTaxFilingItemStatus",
      "claimedSubtotalAmount" = EXCLUDED."claimedSubtotalAmount",
      "claimedVatAmount" = EXCLUDED."claimedVatAmount",
      "claimedTotalAmount" = EXCLUDED."claimedTotalAmount",
      "eligibilitySnapshot" = EXCLUDED."eligibilitySnapshot",
      "documentSnapshot" = EXCLUDED."documentSnapshot",
      "selectedAt" = EXCLUDED."selectedAt",
      "filedAt" = NULL,
      "removedAt" = NULL,
      "removedReason" = NULL,
      "version" = "InputTaxFilingItem"."version" + 1
    RETURNING *
  `);
  return rows[0] || null;
};

const submitBatch = async ({ batchId, filedAt }, tx = prisma) => {
  const itemCount = await tx.$executeRaw(Prisma.sql`
    UPDATE "InputTaxFilingItem"
    SET
      "status" = 'FILED'::"InputTaxFilingItemStatus",
      "filedAt" = ${filedAt},
      "version" = "version" + 1
    WHERE "batchId" = ${Number(batchId)}
      AND "taxDocumentId" IS NOT NULL
      AND "status" = 'SELECTED'::"InputTaxFilingItemStatus"
  `);

  const batches = await tx.$queryRaw(Prisma.sql`
    UPDATE "InputTaxFilingBatch"
    SET "status" = 'SUBMITTED'::"InputTaxFilingStatus", "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(batchId)}
      AND "status" = 'DRAFT'::"InputTaxFilingStatus"
    RETURNING *
  `);

  return { itemCount: Number(itemCount), batch: batches[0] || null };
};

const removeDocumentFromFiling = async ({
  batchId,
  taxDocumentId,
  removedAt,
  removedReason,
  expectedVersion,
}, tx = prisma) => {
  const versionFilter = expectedVersion == null
    ? Prisma.empty
    : Prisma.sql`AND "version" = ${Number(expectedVersion)}`;
  const rows = await tx.$queryRaw(Prisma.sql`
    UPDATE "InputTaxFilingItem"
    SET
      "status" = 'REMOVED'::"InputTaxFilingItemStatus",
      "removedAt" = ${removedAt},
      "removedReason" = ${removedReason},
      "version" = "version" + 1
    WHERE "batchId" = ${Number(batchId)}
      AND "taxDocumentId" = ${filingTaxDocumentKey(taxDocumentId)}
      AND "status" = 'SELECTED'::"InputTaxFilingItemStatus"
      ${versionFilter}
    RETURNING *
  `);
  return rows[0] || null;
};

const findActiveByDocument = async ({ taxDocumentId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT item.*
    FROM "InputTaxFilingItem" item
    JOIN "InputTaxFilingBatch" batch ON batch."id" = item."batchId"
    WHERE item."taxDocumentId" = ${filingTaxDocumentKey(taxDocumentId)}
      AND item."status" IN (
        'SELECTED'::"InputTaxFilingItemStatus",
        'FILED'::"InputTaxFilingItemStatus"
      )
      AND batch."status" <> 'VOIDED'::"InputTaxFilingStatus"
    ORDER BY item."selectedAt" DESC NULLS LAST, item."id" DESC
  `);
  return rows;
};

const findBatchPeriodAuthority = async ({ batchId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      batch."id" AS "batchId",
      batch."branchId",
      batch."year",
      batch."month",
      batch."status" AS "batchStatus",
      period."id" AS "taxPeriodId",
      period."status" AS "taxPeriodStatus"
    FROM "InputTaxFilingBatch" batch
    LEFT JOIN "TaxPeriod" period
      ON period."branchId" = batch."branchId"
      AND period."periodCode" = CONCAT(batch."year", '-', LPAD(batch."month"::text, 2, '0'))
    WHERE batch."id" = ${Number(batchId)}
    LIMIT 1
  `);
  return rows[0] || null;
};

module.exports = Object.freeze({
  filingNumericAmount,
  filingTaxDocumentKey,
  findActiveByDocument,
  findBatchDocumentItemForUpdate,
  findBatchPeriodAuthority,
  lockBatchPeriodAuthority,
  lockInputVatAuthorityForFiling,
  lockTaxDocumentForFiling,
  removeDocumentFromFiling,
  selectDocumentForFiling,
  submitBatch,
});