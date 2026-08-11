CREATE TABLE "TaxClosingFinalization" (
  "id" TEXT NOT NULL,
  "branchId" INTEGER NOT NULL,
  "taxPeriodId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "packageVersion" INTEGER NOT NULL,
  "snapshotHash" VARCHAR(64) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "manifest" JSONB NOT NULL,
  "finalizedById" INTEGER,
  "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TaxClosingFinalization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxClosingFinalization_branch_period_version_key"
  ON "TaxClosingFinalization"("branchId", "taxPeriodId", "version");

CREATE INDEX "TaxClosingFinalization_branch_period_finalizedAt_idx"
  ON "TaxClosingFinalization"("branchId", "taxPeriodId", "finalizedAt");

CREATE INDEX "TaxClosingFinalization_snapshotHash_idx"
  ON "TaxClosingFinalization"("snapshotHash");
