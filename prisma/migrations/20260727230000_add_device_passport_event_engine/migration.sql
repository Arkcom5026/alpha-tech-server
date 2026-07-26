CREATE TABLE "DevicePassportEvent" (
  "id" SERIAL NOT NULL,
  "deviceId" INTEGER NOT NULL,
  "branchId" INTEGER NOT NULL,
  "eventType" VARCHAR(64) NOT NULL,
  "sourceType" VARCHAR(64) NOT NULL,
  "sourceId" INTEGER,
  "title" VARCHAR(180),
  "description" TEXT,
  "actorType" VARCHAR(24),
  "actorEmployeeId" INTEGER,
  "customerVisible" BOOLEAN NOT NULL DEFAULT TRUE,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DevicePassportEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DevicePassportEvent_deviceId_occurredAt_idx"
  ON "DevicePassportEvent"("deviceId", "occurredAt");
CREATE INDEX "DevicePassportEvent_branchId_eventType_occurredAt_idx"
  ON "DevicePassportEvent"("branchId", "eventType", "occurredAt");
CREATE INDEX "DevicePassportEvent_sourceType_sourceId_idx"
  ON "DevicePassportEvent"("sourceType", "sourceId");
CREATE INDEX "DevicePassportEvent_customerVisible_occurredAt_idx"
  ON "DevicePassportEvent"("customerVisible", "occurredAt");

ALTER TABLE "DevicePassportEvent"
  ADD CONSTRAINT "DevicePassportEvent_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DevicePassportEvent"
  ADD CONSTRAINT "DevicePassportEvent_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DevicePassportEvent"
  ADD CONSTRAINT "DevicePassportEvent_actorEmployeeId_fkey"
  FOREIGN KEY ("actorEmployeeId") REFERENCES "EmployeeProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "DevicePassportEvent_source_event_unique"
  ON "DevicePassportEvent"("deviceId", "eventType", "sourceType", "sourceId")
  WHERE "sourceId" IS NOT NULL;
