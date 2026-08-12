'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const mapPayable = (row) => ({
  ...row,
  id: Number(row.id),
  branchId: Number(row.branchId),
  supplierId: Number(row.supplierId),
  createdById: Number(row.createdById),
  version: Number(row.version),
  subtotalAmount: row.subtotalAmount == null ? null : money(row.subtotalAmount),
  taxAmount: row.taxAmount == null ? null : money(row.taxAmount),
  totalAmount: money(row.totalAmount),
  paidAmount: money(row.paidAmount),
  outstandingAmount: money(Number(row.totalAmount) - Number(row.paidAmount)),
});

const listCandidates = async ({ branchId, supplierId = null, limit = 100 }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      receipt."id",
      receipt."code",
      receipt."source",
      receipt."receivedAt",
      receipt."deliveryNoteNumber",
      COALESCE(receipt."supplierId", po."supplierId") AS "supplierId",
      supplier."name" AS "supplierName",
      COALESCE(
        receipt."totalAmount",
        SUM(item."quantity" * item."costPrice"),
        0
      )::numeric AS "totalAmount",
      COALESCE(legacy_paid."paidAmount", 0)::numeric AS "legacyPaidAmount"
    FROM "PurchaseOrderReceipt" receipt
    LEFT JOIN "PurchaseOrder" po ON po."id" = receipt."purchaseOrderId"
    LEFT JOIN "Supplier" supplier
      ON supplier."id" = COALESCE(receipt."supplierId", po."supplierId")
      AND supplier."branchId" = receipt."branchId"
    LEFT JOIN "PurchaseOrderReceiptItem" item ON item."receiptId" = receipt."id"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(link."amountPaid"), 0)::numeric AS "paidAmount"
      FROM "SupplierPaymentReceipt" link
      WHERE link."receiptId" = receipt."id"
    ) legacy_paid ON true
    WHERE receipt."branchId" = ${Number(branchId)}
      AND receipt."statusReceipt" = 'COMPLETED'
      AND COALESCE(receipt."supplierId", po."supplierId") IS NOT NULL
      AND (${supplierId == null ? null : Number(supplierId)}::int IS NULL
        OR COALESCE(receipt."supplierId", po."supplierId") = ${supplierId == null ? null : Number(supplierId)})
      AND NOT EXISTS (
        SELECT 1
        FROM "SupplierPayableReceiptLink" payable_link
        JOIN "SupplierPayable" payable ON payable."id" = payable_link."payableId"
        WHERE payable_link."receiptId" = receipt."id"
          AND payable."status" <> 'CANCELLED'
      )
    GROUP BY receipt."id", po."supplierId", supplier."name", legacy_paid."paidAmount"
    ORDER BY receipt."receivedAt" ASC, receipt."id" ASC
    LIMIT ${Math.min(Math.max(Number(limit) || 100, 1), 200)}
  `);
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    supplierId: Number(row.supplierId),
    totalAmount: money(row.totalAmount),
    legacyPaidAmount: money(row.legacyPaidAmount),
    outstandingAmount: money(Number(row.totalAmount) - Number(row.legacyPaidAmount)),
  }));
};

const list = async ({ branchId, supplierId = null, status = null, limit = 100 }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      payable.*,
      jsonb_build_object('id', supplier."id", 'name', supplier."name") AS supplier,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'receiptId', receipt."id",
            'receiptCode', receipt."code",
            'source', receipt."source",
            'deliveryNoteNumber', receipt."deliveryNoteNumber",
            'allocatedAmount', link."allocatedAmount"
          )
          ORDER BY receipt."receivedAt", receipt."id"
        ) FILTER (WHERE link."id" IS NOT NULL),
        '[]'::jsonb
      ) AS receipts
    FROM "SupplierPayable" payable
    JOIN "Supplier" supplier ON supplier."id" = payable."supplierId"
    LEFT JOIN "SupplierPayableReceiptLink" link ON link."payableId" = payable."id"
    LEFT JOIN "PurchaseOrderReceipt" receipt ON receipt."id" = link."receiptId"
    WHERE payable."branchId" = ${Number(branchId)}
      AND (${supplierId == null ? null : Number(supplierId)}::int IS NULL
        OR payable."supplierId" = ${supplierId == null ? null : Number(supplierId)})
      AND (${status || null}::text IS NULL OR payable."status"::text = ${status || null})
    GROUP BY payable."id", supplier."id", supplier."name"
    ORDER BY payable."dueDate" ASC NULLS LAST, payable."openedAt" DESC
    LIMIT ${Math.min(Math.max(Number(limit) || 100, 1), 200)}
  `);
  return rows.map(mapPayable);
};

const createFromReceipts = async ({
  branchId,
  supplierId,
  receiptIds,
  documentNumber,
  documentDate,
  dueDate,
  note,
  createdById,
}, tx) => {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(28071830::int, ${Number(branchId)}::int)`);

  const suppliers = await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "Supplier"
    WHERE "id" = ${Number(supplierId)}
      AND "branchId" = ${Number(branchId)}
      AND "active" = true
    LIMIT 1
  `);
  if (!suppliers.length) {
    throw Object.assign(new Error('Supplier not found in this branch'), {
      code: 'SUPPLIER_PAYABLE_SUPPLIER_NOT_FOUND',
      statusCode: 404,
      isOperational: true,
    });
  }

  const receipts = await tx.$queryRaw(Prisma.sql`
    SELECT
      receipt."id",
      COALESCE(receipt."supplierId", po."supplierId") AS "supplierId",
      COALESCE(
        receipt."totalAmount",
        SUM(item."quantity" * item."costPrice"),
        0
      )::numeric AS "totalAmount",
      COALESCE(legacy_paid."paidAmount", 0)::numeric AS "paidAmount"
    FROM "PurchaseOrderReceipt" receipt
    LEFT JOIN "PurchaseOrder" po ON po."id" = receipt."purchaseOrderId"
    LEFT JOIN "PurchaseOrderReceiptItem" item ON item."receiptId" = receipt."id"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(link."amountPaid"), 0)::numeric AS "paidAmount"
      FROM "SupplierPaymentReceipt" link
      WHERE link."receiptId" = receipt."id"
    ) legacy_paid ON true
    WHERE receipt."branchId" = ${Number(branchId)}
      AND receipt."statusReceipt" = 'COMPLETED'
      AND receipt."id" IN (${Prisma.join(receiptIds.map(Number))})
      AND NOT EXISTS (
        SELECT 1 FROM "SupplierPayableReceiptLink" existing_link
        JOIN "SupplierPayable" existing_payable ON existing_payable."id" = existing_link."payableId"
        WHERE existing_link."receiptId" = receipt."id"
          AND existing_payable."status" <> 'CANCELLED'
      )
    GROUP BY receipt."id", po."supplierId", legacy_paid."paidAmount"
  `);

  if (receipts.length !== receiptIds.length) {
    throw Object.assign(new Error('Some receipts are unavailable or already assigned to a payable'), {
      code: 'SUPPLIER_PAYABLE_RECEIPT_CONFLICT',
      statusCode: 409,
      isOperational: true,
    });
  }
  if (receipts.some((receipt) => Number(receipt.supplierId) !== Number(supplierId))) {
    throw Object.assign(new Error('All receipts must belong to the selected supplier'), {
      code: 'SUPPLIER_PAYABLE_SUPPLIER_MISMATCH',
      statusCode: 409,
      isOperational: true,
    });
  }

  const totalAmount = money(receipts.reduce((sum, receipt) => sum + Number(receipt.totalAmount), 0));
  if (totalAmount <= 0) {
    throw Object.assign(new Error('Payable total must be greater than zero'), {
      code: 'SUPPLIER_PAYABLE_TOTAL_REQUIRED',
      statusCode: 409,
      isOperational: true,
    });
  }
  const paidAmount = money(receipts.reduce(
    (sum, receipt) => sum + Math.min(Number(receipt.paidAmount), Number(receipt.totalAmount)),
    0,
  ));
  const status = paidAmount >= totalAmount - 0.01 ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'OPEN';
  const month = new Date().toISOString().slice(2, 7).replace('-', '');
  const countRows = await tx.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS count FROM "SupplierPayable"
    WHERE "branchId" = ${Number(branchId)}
      AND "createdAt" >= date_trunc('month', CURRENT_TIMESTAMP)
  `);
  const code = `AP-${String(branchId).padStart(2, '0')}${month}-${String(Number(countRows[0]?.count || 0) + 1).padStart(4, '0')}`;

  const createdRows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "SupplierPayable" (
      "branchId", "supplierId", "code", "status", "documentNumber",
      "documentDate", "dueDate", "totalAmount", "paidAmount", "note", "createdById"
    ) VALUES (
      ${Number(branchId)}, ${Number(supplierId)}, ${code}, ${status}::"SupplierPayableStatus",
      ${documentNumber || null}, ${documentDate ? new Date(documentDate) : null},
      ${dueDate ? new Date(dueDate) : null}, ${totalAmount}, ${paidAmount},
      ${note || null}, ${Number(createdById)}
    )
    RETURNING *
  `);
  const payable = createdRows[0];

  for (const receipt of receipts) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "SupplierPayableReceiptLink" ("payableId", "receiptId", "allocatedAmount")
      VALUES (${Number(payable.id)}, ${Number(receipt.id)}, ${money(receipt.totalAmount)})
    `);
  }

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "SupplierPaymentAllocation" ("paymentId", "payableId", "amount", "allocatedAt")
    SELECT
      legacy_link."paymentId",
      ${Number(payable.id)},
      SUM(legacy_link."amountPaid")::numeric,
      MIN(payment."paidAt")
    FROM "SupplierPaymentReceipt" legacy_link
    JOIN "SupplierPayment" payment ON payment."id" = legacy_link."paymentId"
    WHERE legacy_link."receiptId" IN (${Prisma.join(receiptIds.map(Number))})
      AND payment."branchId" = ${Number(branchId)}
      AND payment."lifecycleStatus" = 'CONFIRMED'
    GROUP BY legacy_link."paymentId"
    ON CONFLICT DO NOTHING
  `);
  return mapPayable({ ...payable, receipts: [] });
};

module.exports = Object.freeze({ createFromReceipts, list, listCandidates });
