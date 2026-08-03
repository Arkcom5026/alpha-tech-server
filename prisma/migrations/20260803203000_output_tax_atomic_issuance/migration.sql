CREATE TYPE "TaxInvoiceKind" AS ENUM ('SHORT', 'FULL');

ALTER TABLE "TaxDocument"
  ADD COLUMN "taxInvoiceKind" "TaxInvoiceKind",
  ADD COLUMN "issuerProfileId" INTEGER,
  ADD COLUMN "issuedDocumentNumber" TEXT,
  ADD COLUMN "issuedSequence" INTEGER,
  ADD COLUMN "issuerSnapshot" JSONB,
  ADD COLUMN "recipientSnapshot" JSONB;

ALTER TABLE "TaxDocument"
  ADD CONSTRAINT "TaxDocument_issuerProfileId_fkey"
  FOREIGN KEY ("issuerProfileId") REFERENCES "TaxIssuerProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "TaxDocument_issuerProfileId_idx"
  ON "TaxDocument"("issuerProfileId");

CREATE UNIQUE INDEX "TaxDocument_issuer_kind_sequence_key"
  ON "TaxDocument"("issuerProfileId", "taxInvoiceKind", "issuedSequence");

CREATE UNIQUE INDEX "TaxDocument_issuer_kind_number_key"
  ON "TaxDocument"("issuerProfileId", "taxInvoiceKind", "issuedDocumentNumber");
