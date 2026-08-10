-- Additive VAT carry-forward authority for PP30 preparation.
-- No backfill or mutation of existing tax-period data.

CREATE TYPE "VatCarryForwardSourceType" AS ENUM ('PRIOR_PERIOD', 'HISTORICAL_OPENING');
CREATE TYPE "VatCarryForwardStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'VOIDED');

CREATE TABLE "VatCarryForwardAuthority" (
  "id" TEXT NOT NULL,
  "branchId" INTEGER NOT NULL,
  "taxPeriodId" TEXT NOT NULL,
  "sourceTaxPeriodId" TEXT,
  "sourceType" "VatCarryForwardSourceType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "status" "VatCarryForwardStatus" NOT NULL DEFAULT 'DRAFT',
  "note" TEXT,
  "sourceSnapshot" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1,
  "confirmedById" INTEGER,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VatCarryForwardAuthority_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VatCarryForwardAuthority_branchId_taxPeriodId_key"
  ON "VatCarryForwardAuthority"("branchId", "taxPeriodId");
CREATE INDEX "VatCarryForwardAuthority_branchId_status_idx"
  ON "VatCarryForwardAuthority"("branchId", "status");
CREATE INDEX "VatCarryForwardAuthority_sourceTaxPeriodId_branchId_idx"
  ON "VatCarryForwardAuthority"("sourceTaxPeriodId", "branchId");
CREATE INDEX "VatCarryForwardAuthority_confirmedById_confirmedAt_idx"
  ON "VatCarryForwardAuthority"("confirmedById", "confirmedAt");

ALTER TABLE "VatCarryForwardAuthority"
  ADD CONSTRAINT "VatCarryForwardAuthority_taxPeriodId_branchId_fkey"
  FOREIGN KEY ("taxPeriodId", "branchId") REFERENCES "TaxPeriod"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VatCarryForwardAuthority"
  ADD CONSTRAINT "VatCarryForwardAuthority_sourceTaxPeriodId_branchId_fkey"
  FOREIGN KEY ("sourceTaxPeriodId", "branchId") REFERENCES "TaxPeriod"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
