'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const mapLink = (row) => row && ({
  ...row,
  id: Number(row.id),
  taxDocumentId: Number(row.taxDocumentId),
  branchId: Number(row.branchId),
  supplierId: Number(row.supplierId),
  linkedByEmployeeId: row.linkedByEmployeeId == null ? null : Number(row.linkedByEmployeeId),
  cancelledByEmployeeId: row.cancelledByEmployeeId == null ? null : Number(row.cancelledByEmployeeId),
  allocatedSubtotal: Number(row.allocatedSubtotal || 0),
  allocatedVatAmount: Number(row.allocatedVatAmount || 0),
  allocatedTotalAmount: Number(row.allocatedTotalAmount || 0),
});

const findDocumentForUpdate = async ({ branchId, taxDocumentId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      document.*,
      COALESCE(
        NULLIF(document."snapshot"->>'supplierId', '')::int,
        NULLIF(candidate."snapshot"->>'supplierId', '')::int,
        supplier_identity."supplierId"
      ) AS "supplierId",
      period."status"::text AS "taxPeriodStatus"
    FROM "TaxDocument" document
    LEFT JOIN "TaxCandidate" candidate ON candidate."id" = document."candidateId"
    LEFT JOIN LATERAL (
      SELECT supplier."id" AS "supplierId"
      FROM "Supplier" supplier
      WHERE supplier."branchId" = document."branchId"
        AND REGEXP_REPLACE(COALESCE(supplier."taxId", ''), '\\D', '', 'g') <> ''
        AND REGEXP_REPLACE(COALESCE(supplier."taxId", ''), '\\D', '', 'g') = REGEXP_REPLACE(
          COALESCE(
            document."counterpartyTaxId",
            document."snapshot"->>'issuerTaxId',
            document."snapshot"->>'counterpartyTaxId',
            candidate."snapshot"->>'issuerTaxId',
            candidate."snapshot"->>'counterpartyTaxId',
            ''
          ),
          '\\D',
          '',
          'g'
        )
      ORDER BY supplier."id" ASC
      LIMIT 1
    ) supplier_identity ON true
    LEFT JOIN LATERAL (
      SELECT "status"
      FROM "TaxPeriod"
      WHERE "branchId" = document."branchId"
        AND COALESCE(document."issuedAt", document."occurredAt") >= "startDate"
        AND COALESCE(document."issuedAt", document."occurredAt") <= "endDate"
      ORDER BY "startDate" DESC
      LIMIT 1
    ) period ON true
    WHERE document."id" = ${Number(taxDocumentId)}
      AND document."branchId" = ${Number(branchId)}
    LIMIT 1
    FOR UPDATE OF document
  `);
  return rows[0] ? {
    ...rows[0],
    id: Number(rows[0].id),
    branchId: Number(rows[0].branchId),
    supplierId: rows[0].supplierId == null ? null : Number(rows[0].supplierId),
  } : null;
};

const findReceiptForUpdate = async ({ branchId, sourceType, sourceId }, tx = prisma) => {
  const id = Number(sourceId);
  const rows = sourceType === 'PO_RECEIPT'
    ? await tx.$queryRaw(Prisma.sql`
      SELECT
        receipt."id"::text AS "sourceId",
        receipt."code" AS "receiptCode",
        receipt."branchId",
        COALESCE(receipt."supplierId", purchase_order."supplierId") AS "supplierId",
        receipt."deliveryNoteNumber",
        receipt."statusReceipt"::text AS "status",
        NULL::numeric AS "subtotalAmount",
        NULL::numeric AS "vatAmount",
        COALESCE(receipt."totalAmount", item_total."totalAmount", 0)::numeric AS "totalAmount"
      FROM "PurchaseOrderReceipt" receipt
      LEFT JOIN "PurchaseOrder" purchase_order ON purchase_order."id" = receipt."purchaseOrderId"
      LEFT JOIN LATERAL (
        SELECT SUM(item."quantity" * item."costPrice")::numeric AS "totalAmount"
        FROM "PurchaseOrderReceiptItem" item
        WHERE item."receiptId" = receipt."id"
      ) item_total ON true
      WHERE receipt."id" = ${id} AND receipt."branchId" = ${Number(branchId)}
      FOR UPDATE OF receipt
    `)
    : await tx.$queryRaw(Prisma.sql`
      SELECT
        receipt."id"::text AS "sourceId",
        receipt."code" AS "receiptCode",
        receipt."branchId",
        receipt."supplierId",
        receipt."deliveryNoteNumber",
        receipt."status",
        receipt."documentSubtotal" AS "subtotalAmount",
        receipt."documentVatAmount" AS "vatAmount",
        COALESCE(receipt."documentTotalAmount", item_total."totalAmount", 0)::numeric AS "totalAmount"
      FROM "QuickReceiptSession" receipt
      LEFT JOIN LATERAL (
        SELECT SUM(item."quantity" * item."costPrice")::numeric AS "totalAmount"
        FROM "QuickReceiptSessionItem" item
        WHERE item."receiptId" = receipt."id"
      ) item_total ON true
      WHERE receipt."id" = ${id} AND receipt."branchId" = ${Number(branchId)}
      FOR UPDATE OF receipt
    `);
  const row = rows[0];
  return row ? {
    ...row,
    branchId: Number(row.branchId),
    supplierId: Number(row.supplierId),
    subtotalAmount: row.subtotalAmount == null ? null : Number(row.subtotalAmount),
    vatAmount: row.vatAmount == null ? null : Number(row.vatAmount),
    totalAmount: Number(row.totalAmount || 0),
  } : null;
};

const sumActiveAllocations = async ({ branchId, sourceType, sourceId, excludingLinkId = null }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      COALESCE(SUM("allocatedSubtotal"), 0)::numeric AS "subtotalAmount",
      COALESCE(SUM("allocatedVatAmount"), 0)::numeric AS "vatAmount",
      COALESCE(SUM("allocatedTotalAmount"), 0)::numeric AS "totalAmount"
    FROM "InputTaxDocumentReceiptLink"
    WHERE "branchId" = ${Number(branchId)}
      AND "sourceType" = ${sourceType}::"InputTaxReceiptSourceType"
      AND "sourceId" = ${String(sourceId)}
      AND "state" = 'ACTIVE'
      AND (${excludingLinkId == null ? null : Number(excludingLinkId)}::int IS NULL
        OR "id" <> ${excludingLinkId == null ? null : Number(excludingLinkId)})
  `);
  return {
    subtotalAmount: Number(rows[0]?.subtotalAmount || 0),
    vatAmount: Number(rows[0]?.vatAmount || 0),
    totalAmount: Number(rows[0]?.totalAmount || 0),
  };
};

const sumActiveDocumentAllocations = async ({
  taxDocumentId,
  excludingLinkId = null,
}, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      COALESCE(SUM("allocatedSubtotal"), 0)::numeric AS "subtotalAmount",
      COALESCE(SUM("allocatedVatAmount"), 0)::numeric AS "vatAmount",
      COALESCE(SUM("allocatedTotalAmount"), 0)::numeric AS "totalAmount"
    FROM "InputTaxDocumentReceiptLink"
    WHERE "taxDocumentId" = ${Number(taxDocumentId)}
      AND "state" = 'ACTIVE'
      AND (${excludingLinkId == null ? null : Number(excludingLinkId)}::int IS NULL
        OR "id" <> ${excludingLinkId == null ? null : Number(excludingLinkId)})
  `);
  return {
    subtotalAmount: Number(rows[0]?.subtotalAmount || 0),
    vatAmount: Number(rows[0]?.vatAmount || 0),
    totalAmount: Number(rows[0]?.totalAmount || 0),
  };
};

const findByLinkKey = async (linkKey, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "InputTaxDocumentReceiptLink" WHERE "linkKey" = ${linkKey} LIMIT 1
  `);
  return rows[0] ? mapLink(rows[0]) : null;
};

const findActiveByDocumentSource = async ({
  taxDocumentId, sourceType, sourceId,
}, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "InputTaxDocumentReceiptLink"
    WHERE "taxDocumentId" = ${Number(taxDocumentId)}
      AND "sourceType" = ${sourceType}::"InputTaxReceiptSourceType"
      AND "sourceId" = ${String(sourceId)}
      AND "state" = 'ACTIVE'
    LIMIT 1 FOR UPDATE
  `);
  return rows[0] ? mapLink(rows[0]) : null;
};

const findByIdForUpdate = async ({ branchId, taxDocumentId, linkId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "InputTaxDocumentReceiptLink"
    WHERE "id" = ${Number(linkId)}
      AND "taxDocumentId" = ${Number(taxDocumentId)}
      AND "branchId" = ${Number(branchId)}
    LIMIT 1 FOR UPDATE
  `);
  return rows[0] ? mapLink(rows[0]) : null;
};

const create = async (input, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "InputTaxDocumentReceiptLink" (
      "taxDocumentId", "branchId", "supplierId", "sourceType", "sourceId",
      "receiptCode", "deliveryNoteNumber", "allocatedSubtotal",
      "allocatedVatAmount", "allocatedTotalAmount", "linkKey", "linkedByEmployeeId"
    ) VALUES (
      ${input.taxDocumentId}, ${input.branchId}, ${input.supplierId},
      ${input.sourceType}::"InputTaxReceiptSourceType", ${input.sourceId},
      ${input.receiptCode}, ${input.deliveryNoteNumber}, ${input.allocatedSubtotal},
      ${input.allocatedVatAmount}, ${input.allocatedTotalAmount},
      ${input.linkKey}, ${input.actorEmployeeId}
    )
    RETURNING *
  `);
  return mapLink(rows[0]);
};

const updateAllocation = async (input, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    UPDATE "InputTaxDocumentReceiptLink"
    SET "allocatedSubtotal" = ${input.allocatedSubtotal},
        "allocatedVatAmount" = ${input.allocatedVatAmount},
        "allocatedTotalAmount" = ${input.allocatedTotalAmount},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${input.linkId} AND "state" = 'ACTIVE'
    RETURNING *
  `);
  return rows[0] ? mapLink(rows[0]) : null;
};

const cancel = async (input, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    UPDATE "InputTaxDocumentReceiptLink"
    SET "state" = 'CANCELLED', "cancelledAt" = CURRENT_TIMESTAMP,
        "cancelledByEmployeeId" = ${input.actorEmployeeId},
        "cancelReason" = ${input.reason}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${input.linkId} AND "state" = 'ACTIVE'
    RETURNING *
  `);
  return rows[0] ? mapLink(rows[0]) : null;
};

const appendEvent = (input, tx = prisma) => tx.$executeRaw(Prisma.sql`
  INSERT INTO "InputTaxDocumentReceiptLinkEvent" (
    "linkId", "eventType", "actorEmployeeId", "reason", "beforeSnapshot", "afterSnapshot"
  ) VALUES (
    ${input.linkId}, ${input.eventType}::"InputTaxReceiptLinkEventType",
    ${input.actorEmployeeId}, ${input.reason},
    ${input.beforeSnapshot ? JSON.stringify(input.beforeSnapshot) : null}::jsonb,
    ${input.afterSnapshot ? JSON.stringify(input.afterSnapshot) : null}::jsonb
  )
`);

const listByDocument = async ({ branchId, taxDocumentId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "InputTaxDocumentReceiptLink"
    WHERE "branchId" = ${Number(branchId)}
      AND "taxDocumentId" = ${Number(taxDocumentId)}
    ORDER BY "createdAt" ASC, "id" ASC
  `);
  return rows.map(mapLink);
};

module.exports = Object.freeze({
  appendEvent,
  cancel,
  create,
  findByIdForUpdate,
  findActiveByDocumentSource,
  findByLinkKey,
  findDocumentForUpdate,
  findReceiptForUpdate,
  listByDocument,
  sumActiveAllocations,
  sumActiveDocumentAllocations,
  updateAllocation,
});
