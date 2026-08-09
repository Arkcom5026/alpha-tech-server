-- Correct a legacy placeholder column that existed as TEXT before output-tax filing authority.
ALTER TABLE "SalesTaxFilingItem"
  DROP CONSTRAINT IF EXISTS "SalesTaxFilingItem_taxDocumentId_fkey";

ALTER TABLE "SalesTaxFilingItem"
  ALTER COLUMN "taxDocumentId" TYPE INTEGER
  USING NULLIF("taxDocumentId", '')::INTEGER;

ALTER TABLE "SalesTaxFilingItem"
  ADD CONSTRAINT "SalesTaxFilingItem_taxDocumentId_fkey"
  FOREIGN KEY ("taxDocumentId") REFERENCES "TaxDocument"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
