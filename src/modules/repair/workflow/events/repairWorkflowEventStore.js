function normalizeEventRow(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    repairJobId: Number(row.repairJobId),
    branchId: Number(row.branchId),
    actorEmployeeId:
      row.actorEmployeeId === null || row.actorEmployeeId === undefined
        ? null
        : Number(row.actorEmployeeId),
  };
}

async function findLatestRepairWorkflowEvent(prisma, { repairJobId, branchId }) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT *
       FROM "RepairWorkflowEvent"
      WHERE "repairJobId" = $1 AND "branchId" = $2
      ORDER BY "occurredAt" DESC, "id" DESC
      LIMIT 1`,
    Number(repairJobId),
    Number(branchId)
  );
  return normalizeEventRow(rows[0] || null);
}

async function findRepairWorkflowHistory(prisma, { repairJobId, branchId, take = 50 }) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT *
       FROM "RepairWorkflowEvent"
      WHERE "repairJobId" = $1 AND "branchId" = $2
      ORDER BY "occurredAt" DESC, "id" DESC
      LIMIT $3`,
    Number(repairJobId),
    Number(branchId),
    Number(take)
  );
  return rows.map(normalizeEventRow);
}

async function publishRepairWorkflowEvent(prisma, event) {
  const metadata = event.metadata == null ? null : JSON.stringify(event.metadata);
  const rows = await prisma.$queryRawUnsafe(
    `INSERT INTO "RepairWorkflowEvent" (
       "repairJobId", "branchId", "eventType", "action", "previousStatus",
       "targetStatus", "eventKey", "correlationId", "causationId", "title",
       "description", "actorEmployeeId", "customerVisible", "metadata", "occurredAt"
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10,
       $11, $12, $13, CAST($14 AS JSONB), $15
     )
     ON CONFLICT ("repairJobId", "eventKey") DO UPDATE SET
       "eventKey" = EXCLUDED."eventKey"
     RETURNING *`,
    Number(event.repairJobId),
    Number(event.branchId),
    event.eventType,
    event.action || null,
    event.previousStatus || null,
    event.targetStatus,
    event.eventKey,
    event.correlationId || null,
    event.causationId || null,
    event.title,
    event.description || null,
    event.actorEmployeeId || null,
    event.customerVisible !== false,
    metadata,
    event.occurredAt || new Date()
  );
  return normalizeEventRow(rows[0]);
}

module.exports = {
  findLatestRepairWorkflowEvent,
  findRepairWorkflowHistory,
  publishRepairWorkflowEvent,
};
