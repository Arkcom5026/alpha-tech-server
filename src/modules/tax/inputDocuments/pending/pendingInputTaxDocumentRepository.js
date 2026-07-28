'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const mapRow = (row) => ({
  sourceType: row.sourceType,
  sourceId: String(row.sourceId),
  receiptCode: row.receiptCode,
  supplierId: Number(row.supplierId),
  supplierName: row.supplierName,
  purchaseOrderCode: row.purchaseOrderCode || null,
  deliveryNoteNumber: row.deliveryNoteNumber || null,
  receivedAt: row.receivedAt,
  itemTypeCount: Number(row.itemTypeCount || 0),
  totalQuantity: Number(row.totalQuantity || 0),
  receiptAmount: Number(row.receiptAmount || 0),
  taxDocumentMode: row.taxDocumentMode,
  pendingDays: Number(row.pendingDays || 0),
});

const listPending = async ({
  branchId, sourceType = null, supplierId = null, keyword = '',
  fromDate = null, toDateExclusive = null, limit = 50, offset = 0,
}, db = prisma) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const normalizedKeyword = String(keyword || '').trim();
  const rows = await db.$queryRaw(Prisma.sql`
    WITH pending_receipts AS (
      SELECT
        'PO_RECEIPT'::text AS "sourceType", r."id"::text AS "sourceId",
        r."code" AS "receiptCode", COALESCE(r."supplierId", po."supplierId") AS "supplierId",
        supplier."name" AS "supplierName", po."code" AS "purchaseOrderCode",
        NULL::text AS "deliveryNoteNumber", r."receivedAt" AS "receivedAt",
        COUNT(DISTINCT item."id")::int AS "itemTypeCount",
        COALESCE(SUM(item."quantity"), 0)::numeric AS "totalQuantity",
        COALESCE(r."totalAmount", SUM(item."quantity" * item."costPrice"), 0)::numeric AS "receiptAmount",
        r."taxDocumentMode"::text AS "taxDocumentMode",
        GREATEST(0, EXTRACT(DAY FROM CURRENT_TIMESTAMP - r."receivedAt"))::int AS "pendingDays"
      FROM "PurchaseOrderReceipt" r
      LEFT JOIN "PurchaseOrder" po ON po."id" = r."purchaseOrderId"
      JOIN "Supplier" supplier ON supplier."id" = COALESCE(r."supplierId", po."supplierId")
      LEFT JOIN "PurchaseOrderReceiptItem" item ON item."receiptId" = r."id"
      WHERE r."branchId" = ${Number(branchId)}
        AND r."statusReceipt"::text = 'COMPLETED'
        AND r."taxDocumentMode"::text = 'NOT_RECEIVED'
        AND supplier."isSystem" = false
      GROUP BY r."id", po."id", supplier."id"
      UNION ALL
      SELECT
        'QUICK_RECEIPT'::text AS "sourceType", quick."id"::text AS "sourceId",
        quick."code" AS "receiptCode", quick."supplierId" AS "supplierId",
        supplier."name" AS "supplierName", NULL::text AS "purchaseOrderCode",
        quick."deliveryNoteNumber" AS "deliveryNoteNumber", quick."completedAt" AS "receivedAt",
        COUNT(DISTINCT item."id")::int AS "itemTypeCount",
        COALESCE(SUM(item."quantity"), 0)::numeric AS "totalQuantity",
        COALESCE(SUM(item."quantity" * item."costPrice"), 0)::numeric AS "receiptAmount",
        quick."taxDocumentMode"::text AS "taxDocumentMode",
        GREATEST(0, EXTRACT(DAY FROM CURRENT_TIMESTAMP - quick."completedAt"))::int AS "pendingDays"
      FROM "QuickReceiptSession" quick
      JOIN "Supplier" supplier ON supplier."id" = quick."supplierId"
      LEFT JOIN "QuickReceiptSessionItem" item ON item."receiptId" = quick."id"
      WHERE quick."branchId" = ${Number(branchId)}
        AND quick."status" = 'COMPLETED'
        AND quick."taxDocumentMode"::text = 'NOT_RECEIVED'
        AND supplier."isSystem" = false
      GROUP BY quick."id", supplier."id"
    ),
    filtered AS (
      SELECT * FROM pending_receipts pending
      WHERE (${sourceType || null}::text IS NULL OR pending."sourceType" = ${sourceType || null})
        AND (${supplierId || null}::int IS NULL OR pending."supplierId" = ${supplierId || null})
        AND (${normalizedKeyword}::text = '' OR CONCAT_WS(
          ' ', pending."receiptCode", pending."supplierName",
          pending."purchaseOrderCode", pending."deliveryNoteNumber"
        ) ILIKE '%' || ${normalizedKeyword} || '%')
        AND (${fromDate || null}::timestamp IS NULL OR pending."receivedAt" >= ${fromDate || null})
        AND (${toDateExclusive || null}::timestamp IS NULL OR pending."receivedAt" < ${toDateExclusive || null})
    )
    SELECT filtered.*, COUNT(*) OVER()::int AS "totalCount"
    FROM filtered
    ORDER BY "receivedAt" ASC, "sourceType" ASC, "sourceId" ASC
    LIMIT ${safeLimit} OFFSET ${safeOffset}
  `);
  return {
    items: rows.map(mapRow),
    total: rows.length ? Number(rows[0].totalCount || 0) : 0,
    limit: safeLimit,
    offset: safeOffset,
  };
};

module.exports = Object.freeze({ listPending });
