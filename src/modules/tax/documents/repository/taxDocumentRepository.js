'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const mapRow = (row) => ({
  ...row,
  id: Number(row.id),
  branchId: Number(row.branchId),
  candidateId: row.candidateId == null ? null : Number(row.candidateId),
  supplierId: row.supplierId == null ? null : Number(row.supplierId),
  activeLinkedReceiptCount: Number(row.activeLinkedReceiptCount || 0),
  activeAllocatedSubtotal: Number(row.activeAllocatedSubtotal || 0),
  activeAllocatedVatAmount: Number(row.activeAllocatedVatAmount || 0),
  activeAllocatedTotalAmount: Number(row.activeAllocatedTotalAmount || 0),
});

const findByIdentityKey = async (identityKey, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "TaxDocument"
    WHERE "identityKey" = ${identityKey}
    LIMIT 1
  `);
  return rows[0] ? mapRow(rows[0]) : null;
};

const findByCandidateId = async (candidateId, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "TaxDocument"
    WHERE "candidateId" = ${Number(candidateId)}
    LIMIT 1
  `);
  return rows[0] ? mapRow(rows[0]) : null;
};

const findByIdForUpdate = async ({ branchId, taxDocumentId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "TaxDocument"
    WHERE "id" = ${Number(taxDocumentId)} AND "branchId" = ${Number(branchId)}
    LIMIT 1 FOR UPDATE
  `);
  return rows[0] ? mapRow(rows[0]) : null;
};

const findDetailById = async ({ branchId, taxDocumentId }, tx = prisma) => {
  const documents = await tx.$queryRaw(Prisma.sql`
    SELECT d.*, row_to_json(c.*) AS candidate
    FROM "TaxDocument" d
    LEFT JOIN "TaxCandidate" c ON c."id" = d."candidateId"
    WHERE d."id" = ${Number(taxDocumentId)}
      AND d."branchId" = ${Number(branchId)}
    LIMIT 1
  `);
  if (!documents[0]) return null;

  const events = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "TaxDocumentLifecycleEvent"
    WHERE "taxDocumentId" = ${Number(taxDocumentId)}
    ORDER BY "occurredAt" ASC, "id" ASC
  `);

  return {
    ...mapRow(documents[0]),
    lifecycleEvents: events.map((event) => ({
      ...event,
      id: Number(event.id),
      taxDocumentId: Number(event.taxDocumentId),
      actorEmployeeId: event.actorEmployeeId == null ? null : Number(event.actorEmployeeId),
    })),
  };
};

const create = async (document, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "TaxDocument" (
      "branchId", "candidateId", "documentType", "documentNumber",
      "counterpartyTaxId", "identityKey", "status", "issuedAt", "occurredAt",
      "currency", "subtotalAmount", "taxAmount", "totalAmount", "snapshot"
    ) VALUES (
      ${document.branchId}, ${document.candidateId}, ${document.documentType},
      ${document.documentNumber}, ${document.counterpartyTaxId}, ${document.identityKey},
      ${document.status}, ${document.issuedAt ? new Date(document.issuedAt) : null},
      ${new Date(document.occurredAt)}, ${document.currency || 'THB'},
      ${document.subtotalAmount || 0}, ${document.taxAmount || 0}, ${document.totalAmount || 0},
      ${JSON.stringify(document.snapshot || {})}::jsonb
    )
    RETURNING *
  `);
  return mapRow(rows[0]);
};

const updateStatus = async ({ branchId, taxDocumentId, expectedStatus, targetStatus }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    UPDATE "TaxDocument"
    SET "status" = ${targetStatus}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(taxDocumentId)}
      AND "branchId" = ${Number(branchId)}
      AND "status" = ${expectedStatus}
    RETURNING *
  `);
  return rows[0] ? mapRow(rows[0]) : null;
};

const refreshDraftRecipientIdentity = async ({
  branchId,
  taxDocumentId,
  snapshot,
  counterpartyTaxId,
}, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    UPDATE "TaxDocument"
    SET
      "snapshot" = ${JSON.stringify(snapshot || {})}::jsonb,
      "counterpartyTaxId" = ${counterpartyTaxId || null},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(taxDocumentId)}
      AND "branchId" = ${Number(branchId)}
      AND "status" = 'DRAFT'
      AND "documentType" = 'OUTPUT_TAX_INVOICE'
      AND "issuerProfileId" IS NULL
    RETURNING *
  `);
  return rows[0] ? mapRow(rows[0]) : null;
};

const issueOutputTaxDocument = async ({
  branchId,
  taxDocumentId,
  issuerProfileId,
  taxInvoiceKind,
  issuedDocumentNumber,
  issuedSequence,
  issuerSnapshot,
  recipientSnapshot,
  counterpartyTaxId,
}, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    UPDATE "TaxDocument"
    SET
      "status" = 'REGISTERED',
      "issuedAt" = CURRENT_TIMESTAMP,
      "issuerProfileId" = ${Number(issuerProfileId)},
      "taxInvoiceKind" = ${taxInvoiceKind}::"TaxInvoiceKind",
      "issuedDocumentNumber" = ${issuedDocumentNumber},
      "issuedSequence" = ${Number(issuedSequence)},
      "issuerSnapshot" = ${JSON.stringify(issuerSnapshot)}::jsonb,
      "recipientSnapshot" = ${recipientSnapshot ? JSON.stringify(recipientSnapshot) : null}::jsonb,
      "counterpartyTaxId" = ${counterpartyTaxId || null},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(taxDocumentId)}
      AND "branchId" = ${Number(branchId)}
      AND "status" = 'DRAFT'
      AND "issuerProfileId" IS NULL
    RETURNING *
  `);
  return rows[0] ? mapRow(rows[0]) : null;
};

const appendLifecycleEvent = async ({ taxDocumentId, fromStatus, toStatus, reason, actorEmployeeId, metadata }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "TaxDocumentLifecycleEvent" (
      "taxDocumentId", "fromStatus", "toStatus", "reason", "actorEmployeeId", "metadata"
    ) VALUES (
      ${Number(taxDocumentId)}, ${fromStatus || null}, ${toStatus}, ${reason || null},
      ${actorEmployeeId ? Number(actorEmployeeId) : null}, ${JSON.stringify(metadata || {})}::jsonb
    )
    RETURNING *
  `);
  return rows[0];
};

const list = async ({ branchId, status, documentType, limit = 50, offset = 0 }, tx = prisma) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT
      document.*,
      COALESCE(
        NULLIF(document."snapshot"->>'supplierId', '')::int,
        NULLIF(candidate."snapshot"->>'supplierId', '')::int,
        supplier_identity."supplierId"
      ) AS "supplierId",
      COALESCE(link_totals."activeLinkedReceiptCount", 0)::int AS "activeLinkedReceiptCount",
      COALESCE(link_totals."activeAllocatedSubtotal", 0)::numeric AS "activeAllocatedSubtotal",
      COALESCE(link_totals."activeAllocatedVatAmount", 0)::numeric AS "activeAllocatedVatAmount",
      COALESCE(link_totals."activeAllocatedTotalAmount", 0)::numeric AS "activeAllocatedTotalAmount"
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
      SELECT
        COUNT(*)::int AS "activeLinkedReceiptCount",
        COALESCE(SUM(link."allocatedSubtotal"), 0)::numeric AS "activeAllocatedSubtotal",
        COALESCE(SUM(link."allocatedVatAmount"), 0)::numeric AS "activeAllocatedVatAmount",
        COALESCE(SUM(link."allocatedTotalAmount"), 0)::numeric AS "activeAllocatedTotalAmount"
      FROM "InputTaxDocumentReceiptLink" link
      WHERE link."taxDocumentId" = document."id"
        AND link."state" = 'ACTIVE'
    ) link_totals ON true
    WHERE document."branchId" = ${Number(branchId)}
      AND (${status || null}::text IS NULL OR document."status" = ${status || null})
      AND (${documentType || null}::text IS NULL OR document."documentType" = ${documentType || null})
    ORDER BY document."occurredAt" DESC, document."id" DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}
  `);
  return rows.map(mapRow);
};

module.exports = Object.freeze({
  findByIdentityKey,
  findByCandidateId,
  findByIdForUpdate,
  findDetailById,
  create,
  updateStatus,
  refreshDraftRecipientIdentity,
  issueOutputTaxDocument,
  appendLifecycleEvent,
  list,
});
