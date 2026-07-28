'use strict';

const { prisma, Prisma } = require('../../../../../../lib/prisma');

const mapPeriodRow = (row) => ({
  ...row,
  id: Number(row.id),
  branchId: Number(row.branchId),
  year: Number(row.year),
  month: Number(row.month),
  documentCount: Number(row.documentCount),
  activeDocumentCount: Number(row.activeDocumentCount),
  cancelledDocumentCount: Number(row.cancelledDocumentCount),
  closeRequestedByEmployeeId:
    row.closeRequestedByEmployeeId == null ? null : Number(row.closeRequestedByEmployeeId),
  closedByEmployeeId: row.closedByEmployeeId == null ? null : Number(row.closedByEmployeeId),
  reopenedByEmployeeId: row.reopenedByEmployeeId == null ? null : Number(row.reopenedByEmployeeId),
  version: Number(row.version),
});

const mapEventRow = (row) => ({
  ...row,
  id: Number(row.id),
  outputTaxPeriodId: Number(row.outputTaxPeriodId),
  actorEmployeeId: row.actorEmployeeId == null ? null : Number(row.actorEmployeeId),
  periodVersion: Number(row.periodVersion),
});

const findById = async ({ branchId, outputTaxPeriodId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT *
    FROM "OutputTaxPeriod"
    WHERE "id" = ${Number(outputTaxPeriodId)}
      AND "branchId" = ${Number(branchId)}
    LIMIT 1
  `);

  return rows[0] ? mapPeriodRow(rows[0]) : null;
};

const findByIdForUpdate = async ({ branchId, outputTaxPeriodId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT *
    FROM "OutputTaxPeriod"
    WHERE "id" = ${Number(outputTaxPeriodId)}
      AND "branchId" = ${Number(branchId)}
    LIMIT 1
    FOR UPDATE
  `);

  return rows[0] ? mapPeriodRow(rows[0]) : null;
};

const findByBranchYearMonth = async ({ branchId, year, month }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT *
    FROM "OutputTaxPeriod"
    WHERE "branchId" = ${Number(branchId)}
      AND "year" = ${Number(year)}
      AND "month" = ${Number(month)}
    LIMIT 1
  `);

  return rows[0] ? mapPeriodRow(rows[0]) : null;
};

const create = async (
  {
    branchId,
    year,
    month,
    currency = 'THB',
    documentCount = 0,
    activeDocumentCount = 0,
    cancelledDocumentCount = 0,
    subtotalAmount = 0,
    taxAmount = 0,
    totalAmount = 0,
    snapshot = {},
  },
  tx = prisma,
) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "OutputTaxPeriod" (
      "branchId", "year", "month", "currency",
      "documentCount", "activeDocumentCount", "cancelledDocumentCount",
      "subtotalAmount", "taxAmount", "totalAmount", "snapshot"
    ) VALUES (
      ${Number(branchId)}, ${Number(year)}, ${Number(month)}, ${String(currency || 'THB')},
      ${Number(documentCount)}, ${Number(activeDocumentCount)}, ${Number(cancelledDocumentCount)},
      ${subtotalAmount}, ${taxAmount}, ${totalAmount}, ${JSON.stringify(snapshot || {})}::jsonb
    )
    RETURNING *
  `);

  return mapPeriodRow(rows[0]);
};

const updateSnapshot = async (
  {
    branchId,
    outputTaxPeriodId,
    expectedVersion,
    documentCount,
    activeDocumentCount,
    cancelledDocumentCount,
    subtotalAmount,
    taxAmount,
    totalAmount,
    snapshot,
  },
  tx = prisma,
) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    UPDATE "OutputTaxPeriod"
    SET "documentCount" = ${Number(documentCount)},
        "activeDocumentCount" = ${Number(activeDocumentCount)},
        "cancelledDocumentCount" = ${Number(cancelledDocumentCount)},
        "subtotalAmount" = ${subtotalAmount},
        "taxAmount" = ${taxAmount},
        "totalAmount" = ${totalAmount},
        "snapshot" = ${JSON.stringify(snapshot || {})}::jsonb,
        "version" = "version" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(outputTaxPeriodId)}
      AND "branchId" = ${Number(branchId)}
      AND "version" = ${Number(expectedVersion)}
    RETURNING *
  `);

  return rows[0] ? mapPeriodRow(rows[0]) : null;
};

const transitionStatus = async (
  {
    branchId,
    outputTaxPeriodId,
    expectedStatus,
    targetStatus,
    expectedVersion,
    actorEmployeeId = null,
    reason = null,
    occurredAt = new Date(),
  },
  tx = prisma,
) => {
  const actorId = actorEmployeeId == null ? null : Number(actorEmployeeId);
  const eventTime = new Date(occurredAt);

  const rows = await tx.$queryRaw(Prisma.sql`
    UPDATE "OutputTaxPeriod"
    SET "status" = ${String(targetStatus)},
        "closeRequestedAt" = CASE WHEN ${String(targetStatus)} = 'CLOSING' THEN ${eventTime} ELSE "closeRequestedAt" END,
        "closedAt" = CASE WHEN ${String(targetStatus)} = 'CLOSED' THEN ${eventTime} ELSE "closedAt" END,
        "reopenedAt" = CASE WHEN ${String(targetStatus)} = 'REOPENED' THEN ${eventTime} ELSE "reopenedAt" END,
        "closeReason" = CASE WHEN ${String(targetStatus)} IN ('CLOSING', 'CLOSED') THEN ${reason} ELSE "closeReason" END,
        "reopenReason" = CASE WHEN ${String(targetStatus)} = 'REOPENED' THEN ${reason} ELSE "reopenReason" END,
        "closeRequestedByEmployeeId" = CASE WHEN ${String(targetStatus)} = 'CLOSING' THEN ${actorId} ELSE "closeRequestedByEmployeeId" END,
        "closedByEmployeeId" = CASE WHEN ${String(targetStatus)} = 'CLOSED' THEN ${actorId} ELSE "closedByEmployeeId" END,
        "reopenedByEmployeeId" = CASE WHEN ${String(targetStatus)} = 'REOPENED' THEN ${actorId} ELSE "reopenedByEmployeeId" END,
        "version" = "version" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(outputTaxPeriodId)}
      AND "branchId" = ${Number(branchId)}
      AND "status" = ${String(expectedStatus)}
      AND "version" = ${Number(expectedVersion)}
    RETURNING *
  `);

  return rows[0] ? mapPeriodRow(rows[0]) : null;
};

const appendEvent = async (
  {
    outputTaxPeriodId,
    eventType,
    fromStatus = null,
    toStatus,
    reason = null,
    actorEmployeeId = null,
    periodVersion,
    snapshot = null,
    occurredAt = new Date(),
  },
  tx = prisma,
) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "OutputTaxPeriodEvent" (
      "outputTaxPeriodId", "eventType", "fromStatus", "toStatus", "reason",
      "actorEmployeeId", "periodVersion", "snapshot", "occurredAt"
    ) VALUES (
      ${Number(outputTaxPeriodId)}, ${String(eventType)}, ${fromStatus == null ? null : String(fromStatus)},
      ${String(toStatus)}, ${reason},
      ${actorEmployeeId == null ? null : Number(actorEmployeeId)}, ${Number(periodVersion)},
      ${snapshot == null ? null : JSON.stringify(snapshot)}::jsonb, ${new Date(occurredAt)}
    )
    RETURNING *
  `);

  return mapEventRow(rows[0]);
};

const listEvents = async ({ outputTaxPeriodId }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT *
    FROM "OutputTaxPeriodEvent"
    WHERE "outputTaxPeriodId" = ${Number(outputTaxPeriodId)}
    ORDER BY "occurredAt" ASC, "id" ASC
  `);

  return rows.map(mapEventRow);
};

const list = async ({ branchId, status = null, year = null, limit = 50, offset = 0 }, tx = prisma) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT *
    FROM "OutputTaxPeriod"
    WHERE "branchId" = ${Number(branchId)}
      AND (${status}::text IS NULL OR "status" = ${status})
      AND (${year}::int IS NULL OR "year" = ${year == null ? null : Number(year)})
    ORDER BY "year" DESC, "month" DESC, "id" DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}
  `);

  return rows.map(mapPeriodRow);
};

module.exports = Object.freeze({
  findById,
  findByIdForUpdate,
  findByBranchYearMonth,
  create,
  updateSnapshot,
  transitionStatus,
  appendEvent,
  listEvents,
  list,
});
