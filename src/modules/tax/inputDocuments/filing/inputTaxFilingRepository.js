'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

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
      ${Number(taxDocumentId)},
      'SELECTED'::"InputTaxFilingItemStatus",
      ${claimedSubtotalAmount},
      ${claimedVatAmount},
      ${claimedTotalAmount},
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

const markBatchFiled = async ({ batchId, filedAt }, tx = prisma) => tx.$executeRaw(Prisma.sql`
  UPDATE "InputTaxFilingItem"
  SET
    "status" = 'FILED'::"InputTaxFilingItemStatus",
    "filedAt" = ${filedAt},
    "version" = "version" + 1
  WHERE "batchId" = ${Number(batchId)}
    AND "taxDocumentId" IS NOT NULL
    AND "status" = 'SELECTED'::"InputTaxFilingItemStatus"
`);

const removeDocumentFromFiling = async ({ batchId, taxDocumentId, removedAt, removedReason }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    UPDATE "InputTaxFilingItem"
    SET
      "status" = 'REMOVED'::"InputTaxFilingItemStatus",
      "removedAt" = ${removedAt},
      "removedReason" = ${removedReason},
      "version" = "version" + 1
    WHERE "batchId" = ${Number(batchId)}
      AND "taxDocumentId" = ${Number(taxDocumentId)}
      AND "status" = 'SELECTED'::"InputTaxFilingItemStatus"
    RETURNING *
  `);
  return rows[0] || null;
};

const findActiveByDocument = async ({ taxDocumentId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT item.*
    FROM "InputTaxFilingItem" item
    JOIN "InputTaxFilingBatch" batch ON batch."id" = item."batchId"
    WHERE item."taxDocumentId" = ${Number(taxDocumentId)}
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
  findBatchPeriodAuthority,
  findActiveByDocument,
  markBatchFiled,
  removeDocumentFromFiling,
  selectDocumentForFiling,
});
