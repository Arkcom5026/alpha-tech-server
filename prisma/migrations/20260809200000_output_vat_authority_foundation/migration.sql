-- Step 6 Output VAT authority foundation.
-- Additive only: no data migration or legacy Sale authority mutation.

CREATE UNIQUE INDEX "TaxDocument_id_branchId_key"
  ON "TaxDocument"("id", "branchId");

CREATE UNIQUE INDEX "TaxPeriod_id_branchId_key"
  ON "TaxPeriod"("id", "branchId");

CREATE TABLE "OutputVatRecord" (
  "id" TEXT NOT NULL,
  "branchId" INTEGER NOT NULL,
  "taxDocumentId" INTEGER NOT NULL,
  "taxPeriodId" TEXT,
  "ledgerType" "TaxLedgerType" NOT NULL,
  "replayKey" TEXT NOT NULL,
  "authorityVersion" INTEGER NOT NULL DEFAULT 1,
  "documentType" TEXT NOT NULL,
  "taxInvoiceKind" "TaxInvoiceKind",
  "documentNumber" TEXT NOT NULL,
  "issuedDocumentNumber" TEXT,
  "documentDate" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'THB',
  "subtotalAmount" DECIMAL(14,2) NOT NULL,
  "taxAmount" DECIMAL(14,2) NOT NULL,
  "totalAmount" DECIMAL(14,2) NOT NULL,
  "counterpartyName" TEXT,
  "counterpartyTaxId" TEXT,
  "counterpartyBranchCode" VARCHAR(5),
  "issuerSnapshot" JSONB NOT NULL,
  "recipientSnapshot" JSONB,
  "documentSnapshot" JSONB NOT NULL,
  "originalTaxDocumentId" INTEGER,
  "originalDocumentNumber" TEXT,
  "projectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutputVatRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutputVatRecord_taxDocumentId_key"
  ON "OutputVatRecord"("taxDocumentId");

CREATE UNIQUE INDEX "OutputVatRecord_replayKey_key"
  ON "OutputVatRecord"("replayKey");

CREATE UNIQUE INDEX "OutputVatRecord_taxDocumentId_branchId_key"
  ON "OutputVatRecord"("taxDocumentId", "branchId");

CREATE INDEX "OutputVatRecord_branchId_documentDate_idx"
  ON "OutputVatRecord"("branchId", "documentDate");

CREATE INDEX "OutputVatRecord_branchId_ledgerType_documentDate_idx"
  ON "OutputVatRecord"("branchId", "ledgerType", "documentDate");

CREATE INDEX "OutputVatRecord_taxPeriodId_documentDate_idx"
  ON "OutputVatRecord"("taxPeriodId", "documentDate");

CREATE INDEX "OutputVatRecord_originalTaxDocumentId_idx"
  ON "OutputVatRecord"("originalTaxDocumentId");

ALTER TABLE "OutputVatRecord"
  ADD CONSTRAINT "OutputVatRecord_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OutputVatRecord"
  ADD CONSTRAINT "OutputVatRecord_taxDocumentId_branchId_fkey"
  FOREIGN KEY ("taxDocumentId", "branchId") REFERENCES "TaxDocument"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OutputVatRecord"
  ADD CONSTRAINT "OutputVatRecord_taxPeriodId_branchId_fkey"
  FOREIGN KEY ("taxPeriodId", "branchId") REFERENCES "TaxPeriod"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OutputVatRecord"
  ADD CONSTRAINT "OutputVatRecord_originalTaxDocumentId_branchId_fkey"
  FOREIGN KEY ("originalTaxDocumentId", "branchId") REFERENCES "TaxDocument"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
