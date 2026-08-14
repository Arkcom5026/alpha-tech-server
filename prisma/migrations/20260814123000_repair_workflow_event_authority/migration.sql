CREATE TABLE IF NOT EXISTS "RepairWorkflowEvent" (
    "id" SERIAL NOT NULL,
    "repairJobId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "action" TEXT,
    "previousStatus" TEXT,
    "targetStatus" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "correlationId" TEXT,
    "causationId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "actorEmployeeId" INTEGER,
    "customerVisible" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairWorkflowEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RepairWorkflowEvent_repairJobId_fkey"
      FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "RepairWorkflowEvent_repairJobId_eventKey_key"
  ON "RepairWorkflowEvent"("repairJobId", "eventKey");

CREATE INDEX IF NOT EXISTS "RepairWorkflowEvent_repairJobId_occurredAt_id_idx"
  ON "RepairWorkflowEvent"("repairJobId", "occurredAt", "id");

CREATE INDEX IF NOT EXISTS "RepairWorkflowEvent_branchId_occurredAt_idx"
  ON "RepairWorkflowEvent"("branchId", "occurredAt");
