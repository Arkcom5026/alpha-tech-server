'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const mapRow = (row) => ({
  ...row,
  id: Number(row.id),
  branchId: Number(row.branchId),
});

const findByRegistrationKey = async (registrationKey, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "TaxCandidate"
    WHERE "registrationKey" = ${registrationKey}
    LIMIT 1
  `);
  return rows[0] ? mapRow(rows[0]) : null;
};

const create = async (candidate, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "TaxCandidate" (
      "branchId", "sourceType", "sourceId", "sourceDocumentNo",
      "registrationKey", "status", "occurredAt", "snapshot"
    ) VALUES (
      ${candidate.branchId}, ${candidate.sourceType}, ${candidate.sourceId},
      ${candidate.sourceDocumentNo}, ${candidate.registrationKey}, ${candidate.status}::"TaxCandidateStatus",
      ${new Date(candidate.occurredAt)}, ${JSON.stringify(candidate.snapshot)}::jsonb
    )
    RETURNING *
  `);
  return mapRow(rows[0]);
};

const updateMapped = async ({ id, mappedDocumentType }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    UPDATE "TaxCandidate"
    SET "status" = 'MAPPED'::"TaxCandidateStatus",
        "mappedDocumentType" = ${mappedDocumentType},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
    RETURNING *
  `);
  return rows[0] ? mapRow(rows[0]) : null;
};

const updateConverted = async (id, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    UPDATE "TaxCandidate"
    SET "status" = 'CONVERTED'::"TaxCandidateStatus",
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
    RETURNING *
  `);
  return rows[0] ? mapRow(rows[0]) : null;
};

const list = async ({ branchId, status, sourceType, limit = 50, offset = 0 }, tx = prisma) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "TaxCandidate"
    WHERE "branchId" = ${Number(branchId)}
      AND (${status || null}::text IS NULL OR "status"::text = ${status || null})
      AND (${sourceType || null}::text IS NULL OR "sourceType" = ${sourceType || null})
    ORDER BY "occurredAt" DESC, "id" DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}
  `);
  return rows.map(mapRow);
};

module.exports = Object.freeze({
  findByRegistrationKey,
  create,
  updateMapped,
  updateConverted,
  list,
});
