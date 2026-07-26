CREATE TABLE "RepairTrackingAccess" (
  "id" SERIAL NOT NULL,
  "repairJobId" INTEGER NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastAccessedAt" TIMESTAMP(3),
  "createdByEmployeeId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RepairTrackingAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RepairTrackingAccess_tokenHash_key"
  ON "RepairTrackingAccess"("tokenHash");

CREATE INDEX "RepairTrackingAccess_repairJobId_createdAt_idx"
  ON "RepairTrackingAccess"("repairJobId", "createdAt");

CREATE INDEX "RepairTrackingAccess_expiresAt_idx"
  ON "RepairTrackingAccess"("expiresAt");

CREATE INDEX "RepairTrackingAccess_revokedAt_idx"
  ON "RepairTrackingAccess"("revokedAt");

ALTER TABLE "RepairTrackingAccess"
  ADD CONSTRAINT "RepairTrackingAccess_repairJobId_fkey"
  FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RepairTrackingAccess"
  ADD CONSTRAINT "RepairTrackingAccess_createdByEmployeeId_fkey"
  FOREIGN KEY ("createdByEmployeeId") REFERENCES "EmployeeProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
