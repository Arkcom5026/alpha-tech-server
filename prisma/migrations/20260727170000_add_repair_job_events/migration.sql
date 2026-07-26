CREATE TABLE "RepairJobEvent" (
  "id" SERIAL NOT NULL,
  "repairJobId" INTEGER NOT NULL,
  "eventType" VARCHAR(64) NOT NULL,
  "fromStatus" VARCHAR(64),
  "toStatus" VARCHAR(64),
  "customerVisible" BOOLEAN NOT NULL DEFAULT false,
  "customerTitle" VARCHAR(160),
  "customerMessage" TEXT,
  "internalNote" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "performedByEmployeeId" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RepairJobEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RepairJobEvent_repairJobId_occurredAt_idx"
  ON "RepairJobEvent"("repairJobId", "occurredAt");

CREATE INDEX "RepairJobEvent_repairJobId_customerVisible_occurredAt_idx"
  ON "RepairJobEvent"("repairJobId", "customerVisible", "occurredAt");

CREATE INDEX "RepairJobEvent_eventType_occurredAt_idx"
  ON "RepairJobEvent"("eventType", "occurredAt");

CREATE INDEX "RepairJobEvent_performedByEmployeeId_occurredAt_idx"
  ON "RepairJobEvent"("performedByEmployeeId", "occurredAt");

ALTER TABLE "RepairJobEvent"
  ADD CONSTRAINT "RepairJobEvent_repairJobId_fkey"
  FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RepairJobEvent"
  ADD CONSTRAINT "RepairJobEvent_performedByEmployeeId_fkey"
  FOREIGN KEY ("performedByEmployeeId") REFERENCES "EmployeeProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
