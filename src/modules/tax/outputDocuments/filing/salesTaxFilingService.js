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
    SELECT item.*, record."id" AS "outputVatRecordId",
      COALESCE(record."issuedDocumentNumber", document."issuedDocumentNumber") AS "issuedDocumentNumber",
      COALESCE(record."taxInvoiceKind", document."taxInvoiceKind") AS "taxInvoiceKind",
      COALESCE(record."documentType", document."documentType") AS "documentType",
      COALESCE(record."documentDate", document."issuedAt") AS "issuedAt",
      CASE WHEN record."ledgerType" = 'OUTPUT_VAT_ADJUSTMENT'::"TaxLedgerType" OR (record."id" IS NULL AND document."documentType" = 'OUTPUT_TAX_CREDIT_NOTE') THEN -COALESCE(record."subtotalAmount", document."subtotalAmount") ELSE COALESCE(record."subtotalAmount", document."subtotalAmount") END AS "subtotalAmount",
      CASE WHEN record."ledgerType" = 'OUTPUT_VAT_ADJUSTMENT'::"TaxLedgerType" OR (record."id" IS NULL AND document."documentType" = 'OUTPUT_TAX_CREDIT_NOTE') THEN -COALESCE(record."taxAmount", document."taxAmount") ELSE COALESCE(record."taxAmount", document."taxAmount") END AS "taxAmount",
      CASE WHEN record."ledgerType" = 'OUTPUT_VAT_ADJUSTMENT'::"TaxLedgerType" OR (record."id" IS NULL AND document."documentType" = 'OUTPUT_TAX_CREDIT_NOTE') THEN -COALESCE(record."totalAmount", document."totalAmount") ELSE COALESCE(record."totalAmount", document."totalAmount") END AS "totalAmount",
      COALESCE(record."recipientSnapshot", document."recipientSnapshot") AS "recipientSnapshot",
      COALESCE(record."originalTaxDocumentId", document."originalTaxDocumentId") AS "originalTaxDocumentId",
      record."taxPeriodId"
    FROM "SalesTaxFilingItem" item
    LEFT JOIN "TaxDocument" document ON document."id" = item."taxDocumentId"
    LEFT JOIN "OutputVatRecord" record ON record."taxDocumentId" = item."taxDocumentId"
    WHERE item."batchId" = CAST(${Number(batchId)} AS integer) AND item."status" <> 'REMOVED'::"SalesTaxFilingItemStatus"
    ORDER BY record."documentDate", record."taxDocumentId", item."id"
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
      COALESCE(SUM(CASE WHEN record."ledgerType" = 'OUTPUT_VAT_ADJUSTMENT'::"TaxLedgerType" OR (record."id" IS NULL AND document."documentType" = 'OUTPUT_TAX_CREDIT_NOTE') THEN -COALESCE(record."subtotalAmount", document."subtotalAmount") ELSE COALESCE(record."subtotalAmount", document."subtotalAmount") END) FILTER (WHERE item."status" <> 'REMOVED'::"SalesTaxFilingItemStatus"), 0) AS "subtotalAmount",
      COALESCE(SUM(CASE WHEN record."ledgerType" = 'OUTPUT_VAT_ADJUSTMENT'::"TaxLedgerType" OR (record."id" IS NULL AND document."documentType" = 'OUTPUT_TAX_CREDIT_NOTE') THEN -COALESCE(record."taxAmount", document."taxAmount") ELSE COALESCE(record."taxAmount", document."taxAmount") END) FILTER (WHERE item."status" <> 'REMOVED'::"SalesTaxFilingItemStatus"), 0) AS "taxAmount",
      COALESCE(SUM(CASE WHEN record."ledgerType" = 'OUTPUT_VAT_ADJUSTMENT'::"TaxLedgerType" OR (record."id" IS NULL AND document."documentType" = 'OUTPUT_TAX_CREDIT_NOTE') THEN -COALESCE(record."totalAmount", document."totalAmount") ELSE COALESCE(record."totalAmount", document."totalAmount") END) FILTER (WHERE item."status" <> 'REMOVED'::"SalesTaxFilingItemStatus"), 0) AS "totalAmount"
    FROM "SalesTaxFilingBatch" batch
    LEFT JOIN "SalesTaxFilingItem" item ON item."batchId" = batch."id"
    LEFT JOIN "TaxDocument" document ON document."id" = item."taxDocumentId"
    LEFT JOIN "OutputVatRecord" record ON record."taxDocumentId" = item."taxDocumentId" AND record."branchId" = batch."branchId"
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
      UPDATE "OutputVatRecord" record
      SET "taxPeriodId" = period."id", "updatedAt" = NOW()
      FROM "TaxPeriod" period
      WHERE record."branchId" = ${branchId}
        AND record."taxPeriodId" IS NULL
        AND record."documentDate" >= ${range.start} AND record."documentDate" < ${range.end}
        AND period."branchId" = record."branchId"
        AND period."status" IN ('OPEN'::"TaxPeriodStatus", 'REOPENED'::"TaxPeriodStatus")
        AND record."documentDate" >= period."startDate" AND record."documentDate" <= period."endDate"
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "SalesTaxFilingItem" ("batchId", "taxDocumentId", "status", "documentSnapshot", "selectedAt", "createdAt")
      SELECT ${Number(batch.id)}, record."taxDocumentId", 'SELECTED'::"SalesTaxFilingItemStatus",
        jsonb_build_object(
          'outputVatRecordId', record."id", 'issuedDocumentNumber', record."issuedDocumentNumber",
          'documentType', record."documentType", 'issuedAt', record."documentDate",
          'ledgerType', record."ledgerType", 'subtotalAmount', record."subtotalAmount",
          'taxAmount', record."taxAmount", 'totalAmount', record."totalAmount",
          'recipientSnapshot', record."recipientSnapshot", 'originalTaxDocumentId', record."originalTaxDocumentId",
          'taxPeriodId', record."taxPeriodId"
        ), NOW(), NOW()
      FROM "OutputVatRecord" record
      JOIN "TaxDocument" document ON document."id" = record."taxDocumentId" AND document."branchId" = record."branchId"
      WHERE record."branchId" = ${branchId}
        AND record."ledgerType" IN ('OUTPUT_VAT'::"TaxLedgerType", 'OUTPUT_VAT_ADJUSTMENT'::"TaxLedgerType")
        AND document."status" IN ('REGISTERED', 'UNDER_REVIEW', 'APPROVED')
        AND record."documentDate" >= ${range.start} AND record."documentDate" < ${range.end}
        AND record."issuedDocumentNumber" IS NOT NULL
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
