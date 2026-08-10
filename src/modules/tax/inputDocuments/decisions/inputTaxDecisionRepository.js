'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const mapRow = (row) => row ? Object.freeze({
  ...row,
  id: Number(row.id),
  branchId: Number(row.branchId),
  candidateId: row.candidateId == null ? null : Number(row.candidateId),
}) : null;

const findForUpdate = async ({ branchId, taxDocumentId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT *
    FROM "TaxDocument"
    WHERE "id" = ${Number(taxDocumentId)}
      AND "branchId" = ${Number(branchId)}
    LIMIT 1
    FOR UPDATE
  `);
  return mapRow(rows[0]);
};

const replaceSnapshot = async ({ branchId, taxDocumentId, snapshot }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    UPDATE "TaxDocument"
    SET
      "snapshot" = ${JSON.stringify(snapshot || {})}::jsonb,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(taxDocumentId)}
      AND "branchId" = ${Number(branchId)}
    RETURNING *
  `);
  return mapRow(rows[0]);
};

const appendDecisionEvent = async ({ taxDocumentId, eventType, reason, actorEmployeeId, metadata }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "TaxDocumentLifecycleEvent" (
      "taxDocumentId", "fromStatus", "toStatus", "reason", "actorEmployeeId", "metadata"
    ) VALUES (
      ${Number(taxDocumentId)}, NULL, ${eventType}, ${reason || null},
      ${actorEmployeeId ? Number(actorEmployeeId) : null}, ${JSON.stringify(metadata || {})}::jsonb
    )
    RETURNING *
  `);
  return rows[0] || null;
};

module.exports = Object.freeze({ appendDecisionEvent, findForUpdate, replaceSnapshot });
