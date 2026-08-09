-- Step 8 Input VAT authority foundation.
-- Additive only: no data migration, receipt mutation, stock mutation, or payment mutation.

CREATE TABLE "InputVatRecord" (
  "id" TEXT NOT NULL,
  "branchId" INTEGER NOT NULL,
  "taxDocumentId" INTEGER NOT NULL,
  "taxPeriodId" TEXT,
  "ledgerType" "TaxLedgerType" NOT NULL,
  "replayKey" TEXT NOT NULL,
  "authorityVersion" INTEGER NOT NULL DEFAULT 1,
  "documentType" TEXT NOT NULL,
  "documentNumber" TEXT NOT NULL,
  "documentDate" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'THB',
  "subtotalAmount" DECIMAL(14,2) NOT NULL,
  "taxAmount" DECIMAL(14,2) NOT NULL,
  "totalAmount" DECIMAL(14,2) NOT NULL,
  "supplierName" TEXT,
  "supplierTaxId" TEXT,
  "supplierBranchCode" VARCHAR(5),
  "documentSnapshot" JSONB NOT NULL,
  "originalTaxDocumentId" INTEGER,
  "originalDocumentNumber" TEXT,
  "projectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InputVatRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InputVatRecord_taxDocumentId_key"
  ON "InputVatRecord"("taxDocumentId");

CREATE UNIQUE INDEX "InputVatRecord_replayKey_key"
  ON "InputVatRecord"("replayKey");

CREATE UNIQUE INDEX "InputVatRecord_taxDocumentId_branchId_key"
  ON "InputVatRecord"("taxDocumentId", "branchId");

CREATE INDEX "InputVatRecord_branchId_documentDate_idx"
  ON "InputVatRecord"("branchId", "documentDate");

CREATE INDEX "InputVatRecord_branchId_ledgerType_documentDate_idx"
  ON "InputVatRecord"("branchId", "ledgerType", "documentDate");

CREATE INDEX "InputVatRecord_taxPeriodId_documentDate_idx"
  ON "InputVatRecord"("taxPeriodId", "documentDate");

CREATE INDEX "InputVatRecord_originalTaxDocumentId_idx"
  ON "InputVatRecord"("originalTaxDocumentId");

ALTER TABLE "InputVatRecord"
  ADD CONSTRAINT "InputVatRecord_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InputVatRecord"
  ADD CONSTRAINT "InputVatRecord_taxDocumentId_branchId_fkey"
  FOREIGN KEY ("taxDocumentId", "branchId") REFERENCES "TaxDocument"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InputVatRecord"
  ADD CONSTRAINT "InputVatRecord_taxPeriodId_branchId_fkey"
  FOREIGN KEY ("taxPeriodId", "branchId") REFERENCES "TaxPeriod"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InputVatRecord"
  ADD CONSTRAINT "InputVatRecord_originalTaxDocumentId_branchId_fkey"
  FOREIGN KEY ("originalTaxDocumentId", "branchId") REFERENCES "TaxDocument"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
