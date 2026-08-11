-- Rebind InputTaxFilingItem.taxDocumentId from the legacy TEXT placeholder
-- to the current integer TaxDocument authority.
--
-- Historical context:
-- - 20260726_add_service_asset_foundation added taxDocumentId as TEXT and
--   attached InputTaxFilingItem_taxDocumentId_fkey to the legacy TaxDocument.
-- - 20260729103000_add_tax_document_centric_input_tax_filing used
--   ADD COLUMN IF NOT EXISTS ... INTEGER, so an already-existing TEXT column
--   and its legacy FK survived.
--
-- This migration is intentionally fail-closed. Existing non-null values must
-- already identify a current integer TaxDocument before the column is changed.

BEGIN;

LOCK TABLE "InputTaxFilingItem" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "InputTaxFilingItem" item
    WHERE item."taxDocumentId" IS NOT NULL
      AND (
        BTRIM(item."taxDocumentId"::text) !~ '^[1-9][0-9]*$'
        OR NOT EXISTS (
          SELECT 1
          FROM "TaxDocument" document
          WHERE document."id"::text = BTRIM(item."taxDocumentId"::text)
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'INPUT_TAX_FILING_DOCUMENT_ID_REBIND_BLOCKED',
      DETAIL = 'Existing InputTaxFilingItem.taxDocumentId contains a value that cannot be rebound to the current integer TaxDocument authority.';
  END IF;
END $$;

ALTER TABLE "InputTaxFilingItem"
  DROP CONSTRAINT IF EXISTS "InputTaxFilingItem_taxDocumentId_fkey";

ALTER TABLE "InputTaxFilingItem"
  ALTER COLUMN "taxDocumentId" TYPE INTEGER
  USING NULLIF(BTRIM("taxDocumentId"::text), '')::INTEGER;

ALTER TABLE "InputTaxFilingItem"
  ADD CONSTRAINT "InputTaxFilingItem_taxDocumentId_fkey"
  FOREIGN KEY ("taxDocumentId") REFERENCES "TaxDocument"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
