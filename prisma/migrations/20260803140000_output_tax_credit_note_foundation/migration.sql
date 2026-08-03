-- Credit notes correct an issued output-tax invoice after a completed full sale return.
-- The original invoice remains immutable; one credit note may reference one original invoice and one completed sale return.
ALTER TABLE "TaxIssuerProfile"
  ADD COLUMN "creditNotePrefix" TEXT,
  ADD COLUMN "nextCreditNoteNumber" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "TaxDocument"
  ADD COLUMN "originalTaxDocumentId" INTEGER,
  ADD COLUMN "saleReturnId" INTEGER;

CREATE UNIQUE INDEX "TaxDocument_originalTaxDocumentId_key"
  ON "TaxDocument"("originalTaxDocumentId");

CREATE UNIQUE INDEX "TaxDocument_saleReturnId_key"
  ON "TaxDocument"("saleReturnId");

ALTER TABLE "TaxDocument"
  ADD CONSTRAINT "TaxDocument_originalTaxDocumentId_fkey"
  FOREIGN KEY ("originalTaxDocumentId") REFERENCES "TaxDocument"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaxDocument"
  ADD CONSTRAINT "TaxDocument_saleReturnId_fkey"
  FOREIGN KEY ("saleReturnId") REFERENCES "SaleReturn"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
