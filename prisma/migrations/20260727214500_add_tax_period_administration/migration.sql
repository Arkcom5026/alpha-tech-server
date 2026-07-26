DO $$
BEGIN
  CREATE TYPE "TaxPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED', 'SUBMITTED', 'REOPENED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TaxPeriod" (
  "id" TEXT NOT NULL,
  "branchId" INTEGER NOT NULL,
  "periodCode" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" "TaxPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "closedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "reopenedAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxPeriod_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaxPeriod_branchId_periodCode_key"
  ON "TaxPeriod"("branchId", "periodCode");
CREATE INDEX IF NOT EXISTS "TaxPeriod_branchId_status_idx"
  ON "TaxPeriod"("branchId", "status");
CREATE INDEX IF NOT EXISTS "TaxPeriod_startDate_endDate_idx"
  ON "TaxPeriod"("startDate", "endDate");