CREATE TABLE "RepairCommunicationActivity" (
  "id" SERIAL PRIMARY KEY, "branchId" INTEGER NOT NULL, "repairJobId" INTEGER NOT NULL,
  "actorEmployeeId" INTEGER NOT NULL, "channelType" "CommunicationChannelType" NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'OUTBOUND', "activityType" TEXT NOT NULL,
  "destinationSnapshot" TEXT, "note" TEXT, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepairCommunicationActivity_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RepairCommunicationActivity_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "RepairCommunicationActivity_branchId_repairJobId_occurredAt_idx" ON "RepairCommunicationActivity"("branchId", "repairJobId", "occurredAt");
CREATE INDEX "RepairCommunicationActivity_actorEmployeeId_idx" ON "RepairCommunicationActivity"("actorEmployeeId");
