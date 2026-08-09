'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const fail = (code, message, statusCode = 400) => { const error = new Error(message); error.code = code; error.statusCode = statusCode; throw error; };
const positive = (value, field) => { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed <= 0) fail('SALES_TAX_FILING_INPUT_INVALID', `${field} is required`); return parsed; };
const monthRange = (yearValue, monthValue) => {
  const year = positive(yearValue, 'year'); const month = positive(monthValue, 'month');
  if (month > 12 || year < 2000 || year > 3000) fail('SALES_TAX_FILING_PERIOD_INVALID', 'year or month is invalid');
  return { year, month, start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
};

const loadBatch = async ({ branchId, batchId }, tx = prisma) => {
  const batches = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "SalesTaxFilingBatch" WHERE "id" = CAST(${Number(batchId)} AS integer) AND "branchId" = CAST(${Number(branchId)} AS integer) LIMIT 1
  `);
  if (!batches[0]) return null;
  const items = await tx.$queryRaw(Prisma.sql`
    SELECT item.*, document."issuedDocumentNumber", document."taxInvoiceKind", document."documentType",
      document."issuedAt",
      CASE WHEN document."documentType" = 'OUTPUT_TAX_CREDIT_NOTE' THEN -document."subtotalAmount" ELSE document."subtotalAmount" END AS "subtotalAmount",
      CASE WHEN document."documentType" = 'OUTPUT_TAX_CREDIT_NOTE' THEN -document."taxAmount" ELSE document."taxAmount" END AS "taxAmount",
      CASE WHEN document."documentType" = 'OUTPUT_TAX_CREDIT_NOTE' THEN -document."totalAmount" ELSE document."totalAmount" END AS "totalAmount",
      document."recipientSnapshot", document."originalTaxDocumentId"
    FROM "SalesTaxFilingItem" item
    LEFT JOIN "TaxDocument" document ON document."id" = item."taxDocumentId"
    WHERE item."batchId" = CAST(${Number(batchId)} AS integer) AND item."status" <> 'REMOVED'::"SalesTaxFilingItemStatus"
    ORDER BY document."issuedAt", document."issuedSequence", item."id"
  `);
  return { ...batches[0], items };
};

const listSalesTaxFilings = async ({ branchId, year, month }) => {
  branchId = positive(branchId, 'branchId');
  const yearFilter = year ? positive(year, 'year') : null;
  const monthFilter = month ? positive(month, 'month') : null;
  const batches = await prisma.$queryRaw(Prisma.sql`
    SELECT batch.*,
      COUNT(item."id") FILTER (WHERE item."status" <> 'REMOVED'::"SalesTaxFilingItemStatus")::int AS "itemCount",
      COALESCE(SUM(CASE WHEN document."documentType" = 'OUTPUT_TAX_CREDIT_NOTE' THEN -document."subtotalAmount" ELSE document."subtotalAmount" END) FILTER (WHERE item."status" <> 'REMOVED'::"SalesTaxFilingItemStatus"), 0) AS "subtotalAmount",
      COALESCE(SUM(CASE WHEN document."documentType" = 'OUTPUT_TAX_CREDIT_NOTE' THEN -document."taxAmount" ELSE document."taxAmount" END) FILTER (WHERE item."status" <> 'REMOVED'::"SalesTaxFilingItemStatus"), 0) AS "taxAmount",
      COALESCE(SUM(CASE WHEN document."documentType" = 'OUTPUT_TAX_CREDIT_NOTE' THEN -document."totalAmount" ELSE document."totalAmount" END) FILTER (WHERE item."status" <> 'REMOVED'::"SalesTaxFilingItemStatus"), 0) AS "totalAmount"
    FROM "SalesTaxFilingBatch" batch
    LEFT JOIN "SalesTaxFilingItem" item ON item."batchId" = batch."id"
    LEFT JOIN "TaxDocument" document ON document."id" = item."taxDocumentId"
    WHERE batch."branchId" = CAST(${branchId} AS integer)
      ${yearFilter ? Prisma.sql`AND batch."year" = CAST(${yearFilter} AS integer)` : Prisma.empty}
      ${monthFilter ? Prisma.sql`AND batch."month" = CAST(${monthFilter} AS integer)` : Prisma.empty}
    GROUP BY batch."id" ORDER BY batch."year" DESC, batch."month" DESC, batch."id" DESC
  `);
  return { batches };
};

const prepareSalesTaxFiling = async ({ branchId, year, month, actorEmployeeId }) => {
  branchId = positive(branchId, 'branchId'); actorEmployeeId = positive(actorEmployeeId, 'actorEmployeeId');
  const range = monthRange(year, month);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRaw(Prisma.sql`
      SELECT * FROM "SalesTaxFilingBatch"
      WHERE "branchId" = ${branchId} AND "year" = ${range.year} AND "month" = ${range.month}
      ORDER BY "id" DESC LIMIT 1 FOR UPDATE
    `);
    let batch = existing[0];
    if (batch && batch.status !== 'DRAFT') fail('SALES_TAX_FILING_ALREADY_FINALIZED', 'This filing period is already finalized', 409);
    if (!batch) {
      const rows = await tx.$queryRaw(Prisma.sql`
        INSERT INTO "SalesTaxFilingBatch" ("branchId", "month", "year", "status", "createdById", "createdAt", "updatedAt")
        VALUES (${branchId}, ${range.month}, ${range.year}, 'DRAFT'::"SalesTaxFilingStatus", ${actorEmployeeId}, NOW(), NOW())
        ON CONFLICT ("branchId", "year", "month") DO UPDATE SET "updatedAt" = NOW()
        RETURNING *
      `);
      batch = rows[0];
    }
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "SalesTaxFilingItem" ("batchId", "taxDocumentId", "status", "documentSnapshot", "selectedAt", "createdAt")
      SELECT ${Number(batch.id)}, document."id", 'SELECTED'::"SalesTaxFilingItemStatus",
        jsonb_build_object(
          'issuedDocumentNumber', document."issuedDocumentNumber", 'documentType', document."documentType",
          'issuedAt', document."issuedAt", 'subtotalAmount', document."subtotalAmount",
          'taxAmount', document."taxAmount", 'totalAmount', document."totalAmount",
          'recipientSnapshot', document."recipientSnapshot", 'originalTaxDocumentId', document."originalTaxDocumentId"
        ), NOW(), NOW()
      FROM "TaxDocument" document
      WHERE document."branchId" = ${branchId}
        AND document."documentType" IN ('OUTPUT_TAX_INVOICE', 'OUTPUT_TAX_CREDIT_NOTE')
        AND document."status" IN ('REGISTERED', 'UNDER_REVIEW', 'APPROVED')
        AND document."issuedAt" >= ${range.start} AND document."issuedAt" < ${range.end}
        AND document."issuedDocumentNumber" IS NOT NULL
      ON CONFLICT ("batchId", "taxDocumentId") DO NOTHING
    `);
    return loadBatch({ branchId, batchId: batch.id }, tx);
  });
};

const submitSalesTaxFiling = async ({ branchId, batchId }) => {
  branchId = positive(branchId, 'branchId'); batchId = positive(batchId, 'batchId');
  return prisma.$transaction(async (tx) => {
    const current = await loadBatch({ branchId, batchId }, tx);
    if (!current) fail('SALES_TAX_FILING_NOT_FOUND', 'Sales tax filing was not found', 404);
    if (current.status === 'SUBMITTED') return { replayed: true, batch: current };
    if (current.status !== 'DRAFT' || !current.items.length) fail('SALES_TAX_FILING_NOT_READY', 'A non-empty draft filing is required', 409);
    await tx.$executeRaw(Prisma.sql`UPDATE "SalesTaxFilingItem" SET "status" = 'FILED'::"SalesTaxFilingItemStatus", "filedAt" = NOW() WHERE "batchId" = ${batchId} AND "status" = 'SELECTED'::"SalesTaxFilingItemStatus"`);
    await tx.$executeRaw(Prisma.sql`UPDATE "SalesTaxFilingBatch" SET "status" = 'SUBMITTED'::"SalesTaxFilingStatus", "updatedAt" = NOW() WHERE "id" = ${batchId} AND "branchId" = ${branchId}`);
    return { replayed: false, batch: await loadBatch({ branchId, batchId }, tx) };
  });
};

module.exports = Object.freeze({ listSalesTaxFilings, prepareSalesTaxFiling, submitSalesTaxFiling });
