-- TaxDocument-centric Input Tax Filing Authority
-- Additive migration. Legacy receipt-centric fields remain available as a compatibility bridge.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InputTaxFilingItemStatus') THEN
    CREATE TYPE "InputTaxFilingItemStatus" AS ENUM (
      'SELECTED',
      'FILED',
      'REMOVED',
      'VOIDED'
    );
  END IF;
END $$;

ALTER TABLE "InputTaxFilingItem"
  ADD COLUMN IF NOT EXISTS "taxDocumentId" INTEGER,
  ADD COLUMN IF NOT EXISTS "status" "InputTaxFilingItemStatus" NOT NULL DEFAULT 'SELECTED',
  ADD COLUMN IF NOT EXISTS "claimedSubtotalAmount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "claimedVatAmount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "claimedTotalAmount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "eligibilitySnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "documentSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "selectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "filedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "removedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "InputTaxFilingItem"
  ALTER COLUMN "purchaseOrderReceiptId" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InputTaxFilingItem_taxDocumentId_fkey'
  ) THEN
    ALTER TABLE "InputTaxFilingItem"
      ADD CONSTRAINT "InputTaxFilingItem_taxDocumentId_fkey"
      FOREIGN KEY ("taxDocumentId") REFERENCES "TaxDocument"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "InputTaxFilingItem_batchId_taxDocumentId_key"
  ON "InputTaxFilingItem"("batchId", "taxDocumentId")
  WHERE "taxDocumentId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "InputTaxFilingItem_taxDocumentId_status_idx"
  ON "InputTaxFilingItem"("taxDocumentId", "status");

CREATE INDEX IF NOT EXISTS "InputTaxFilingItem_batchId_status_idx"
  ON "InputTaxFilingItem"("batchId", "status");

CREATE INDEX IF NOT EXISTS "InputTaxFilingItem_selectedAt_idx"
  ON "InputTaxFilingItem"("selectedAt");

CREATE INDEX IF NOT EXISTS "InputTaxFilingItem_filedAt_idx"
  ON "InputTaxFilingItem"("filedAt");

ALTER TABLE "InputTaxFilingItem"
  ADD CONSTRAINT "InputTaxFilingItem_authority_check"
  CHECK (
    "taxDocumentId" IS NOT NULL
    OR "purchaseOrderReceiptId" IS NOT NULL
  ) NOT VALID;

COMMENT ON COLUMN "InputTaxFilingItem"."taxDocumentId" IS
  'Primary filing authority for new input-tax flows. Legacy receipt reference remains a compatibility bridge.';
COMMENT ON COLUMN "InputTaxFilingItem"."eligibilitySnapshot" IS
  'Immutable eligibility decision captured when the document is selected for filing.';
COMMENT ON COLUMN "InputTaxFilingItem"."documentSnapshot" IS
  'Immutable tax-document identity and monetary snapshot captured when selected.';
