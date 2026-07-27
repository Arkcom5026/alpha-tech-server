'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const mapRow = (row) => ({
  ...row,
  id: Number(row.id),
  branchId: Number(row.branchId),
  candidateId: row.candidateId == null ? null : Number(row.candidateId),
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
    SELECT * FROM "TaxDocument"
    WHERE "branchId" = ${Number(branchId)}
      AND (${status || null}::text IS NULL OR "status" = ${status || null})
      AND (${documentType || null}::text IS NULL OR "documentType" = ${documentType || null})
    ORDER BY "occurredAt" DESC, "id" DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}
  `);
  return rows.map(mapRow);
};

module.exports = Object.freeze({
  findByIdentityKey,
  findByCandidateId,
  create,
  appendLifecycleEvent,
  list,
});
