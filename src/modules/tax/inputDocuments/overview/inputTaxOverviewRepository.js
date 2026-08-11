'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const toStringAmount = (value) => (value == null ? '0.00' : String(value));
const toNumber = (value) => Number(value || 0);

const periodExpression = (periodView) => {
  switch (periodView) {
    case 'RECEIVED':
      return Prisma.sql`COALESCE(
        NULLIF(document."snapshot"->>'inputTaxReceivedAt', '')::timestamptz,
        document."occurredAt",
        document."issuedAt"
      )`;
    case 'CLAIM':
      return Prisma.sql`COALESCE(
        filing_summary."selectedAt",
        NULLIF(document."snapshot"->>'inputTaxClaimedAt', '')::timestamptz,
        NULLIF(document."snapshot"->>'inputTaxSelectedAt', '')::timestamptz
      )`;
    case 'FILED':
      return Prisma.sql`COALESCE(
        filing_summary."filedAt",
        NULLIF(document."snapshot"->>'inputTaxFiledAt', '')::timestamptz,
        NULLIF(document."snapshot"->>'inputTaxSubmittedAt', '')::timestamptz
      )`;
    case 'DOCUMENT':
    default:
      return Prisma.sql`COALESCE(document."issuedAt", document."occurredAt")`;
  }
};

const listDocumentProjection = async ({ branchId, periodView = 'DOCUMENT', periodFrom, periodToExclusive }, tx = prisma) => {
  const selectedPeriodExpression = periodExpression(periodView);
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      document."id",
      document."documentType",
      document."documentNumber",
      document."status",
      document."issuedAt",
      document."occurredAt",
      document."currency",
      document."subtotalAmount",
      document."taxAmount",
      document."totalAmount",
      document."counterpartyTaxId",
      document."snapshot",
      document."updatedAt",
      ${selectedPeriodExpression} AS "periodDate",
      COALESCE(link_summary."linkedReceiptCount", 0)::int AS "linkedReceiptCount",
      COALESCE(link_summary."allocatedSubtotal", 0)::numeric AS "allocatedSubtotal",
      COALESCE(link_summary."allocatedVatAmount", 0)::numeric AS "allocatedVatAmount",
      COALESCE(link_summary."allocatedTotalAmount", 0)::numeric AS "allocatedTotalAmount",
      COALESCE(link_summary."sourceTypes", ARRAY[]::text[]) AS "sourceTypes",
      filing_summary."filingItemId",
      filing_summary."filingBatchId",
      filing_summary."filingItemStatus",
      filing_summary."claimedSubtotalAmount",
      filing_summary."claimedVatAmount",
      filing_summary."claimedTotalAmount",
      filing_summary."selectedAt",
      filing_summary."filedAt"
    FROM "TaxDocument" document
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS "linkedReceiptCount",
        SUM(link."allocatedSubtotal")::numeric AS "allocatedSubtotal",
        SUM(link."allocatedVatAmount")::numeric AS "allocatedVatAmount",
        SUM(link."allocatedTotalAmount")::numeric AS "allocatedTotalAmount",
        ARRAY_AGG(DISTINCT link."sourceType"::text ORDER BY link."sourceType"::text) AS "sourceTypes"
      FROM "InputTaxDocumentReceiptLink" link
      WHERE link."taxDocumentId" = document."id"
        AND link."state" = 'ACTIVE'
    ) link_summary ON true
    LEFT JOIN LATERAL (
      SELECT
        item."id" AS "filingItemId",
        item."batchId" AS "filingBatchId",
        item."status"::text AS "filingItemStatus",
        item."claimedSubtotalAmount",
        item."claimedVatAmount",
        item."claimedTotalAmount",
        item."selectedAt",
        item."filedAt"
      FROM "InputTaxFilingItem" item
      JOIN "InputTaxFilingBatch" batch ON batch."id" = item."batchId"
      WHERE item."taxDocumentId" = document."id"
        AND item."status" IN (
          'SELECTED'::"InputTaxFilingItemStatus",
          'FILED'::"InputTaxFilingItemStatus"
        )
        AND batch."status" <> 'VOIDED'::"InputTaxFilingStatus"
      ORDER BY item."filedAt" DESC NULLS LAST, item."selectedAt" DESC NULLS LAST, item."id" DESC
      LIMIT 1
    ) filing_summary ON true
    WHERE document."branchId" = ${Number(branchId)}
      AND ${selectedPeriodExpression} IS NOT NULL
      AND ${selectedPeriodExpression} >= ${periodFrom}
      AND ${selectedPeriodExpression} < ${periodToExclusive}
    ORDER BY ${selectedPeriodExpression} DESC, document."id" DESC
  `);

  return rows.map((row) => ({
    id: Number(row.id),
    documentType: row.documentType,
    documentNumber: row.documentNumber,
    status: row.status,
    issuedAt: row.issuedAt,
    occurredAt: row.occurredAt,
    periodDate: row.periodDate,
    currency: row.currency || 'THB',
    subtotalAmount: toStringAmount(row.subtotalAmount),
    vatAmount: toStringAmount(row.taxAmount),
    totalAmount: toStringAmount(row.totalAmount),
    allocatedSubtotal: toStringAmount(row.allocatedSubtotal),
    allocatedVatAmount: toStringAmount(row.allocatedVatAmount),
    allocatedTotalAmount: toStringAmount(row.allocatedTotalAmount),
    counterpartyTaxId: row.counterpartyTaxId,
    snapshot: row.snapshot || {},
    updatedAt: row.updatedAt,
    linkedReceiptCount: toNumber(row.linkedReceiptCount),
    sourceTypes: Array.isArray(row.sourceTypes) ? row.sourceTypes : [],
    filing: row.filingItemId == null ? null : {
      filingItemId: Number(row.filingItemId),
      filingBatchId: Number(row.filingBatchId),
      status: row.filingItemStatus,
      claimedSubtotalAmount: toStringAmount(row.claimedSubtotalAmount),
      claimedVatAmount: toStringAmount(row.claimedVatAmount),
      claimedTotalAmount: toStringAmount(row.claimedTotalAmount),
      selectedAt: row.selectedAt,
      filedAt: row.filedAt,
    },
  }));
};

module.exports = Object.freeze({ listDocumentProjection, periodExpression });