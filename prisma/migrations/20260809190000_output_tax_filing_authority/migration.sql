-- Additive output-tax filing authority. Legacy sale links remain available for historical batches.
DO $$ BEGIN
  CREATE TYPE "SalesTaxFilingItemStatus" AS ENUM ('SELECTED', 'FILED', 'REMOVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "SalesTaxFilingItem"
  ALTER COLUMN "saleId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "taxDocumentId" INTEGER,
  ADD COLUMN IF NOT EXISTS "status" "SalesTaxFilingItemStatus" NOT NULL DEFAULT 'SELECTED',
  ADD COLUMN IF NOT EXISTS "documentSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "selectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "filedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "SalesTaxFilingItem_batchId_taxDocumentId_key"
  ON "SalesTaxFilingItem"("batchId", "taxDocumentId");

CREATE UNIQUE INDEX IF NOT EXISTS "SalesTaxFilingBatch_branchId_year_month_key"
  ON "SalesTaxFilingBatch"("branchId", "year", "month");

CREATE INDEX IF NOT EXISTS "SalesTaxFilingItem_taxDocumentId_status_idx"
  ON "SalesTaxFilingItem"("taxDocumentId", "status");

DO $$ BEGIN
  ALTER TABLE "SalesTaxFilingItem"
    ADD CONSTRAINT "SalesTaxFilingItem_taxDocumentId_fkey"
    FOREIGN KEY ("taxDocumentId") REFERENCES "TaxDocument"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
