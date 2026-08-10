-- Additive withholding-tax workflow authority.
-- No backfill or mutation of existing TaxExpense/TaxPeriod rows.

CREATE TYPE "WithholdingTaxFormType" AS ENUM ('PND3', 'PND53');
CREATE TYPE "WithholdingTaxRecordStatus" AS ENUM ('DRAFT', 'READY', 'CERTIFIED', 'FILED', 'VOIDED');
CREATE TYPE "WithholdingTaxFilingStatus" AS ENUM ('DRAFT', 'PREPARED', 'SUBMITTED', 'VOIDED');

CREATE TABLE "WithholdingTaxRecord" (
  "id" TEXT NOT NULL,
  "branchId" INTEGER NOT NULL,
  "taxExpenseId" INTEGER NOT NULL,
  "taxPeriodId" TEXT,
  "formType" "WithholdingTaxFormType" NOT NULL,
  "payeeType" "ExpensePayeeType" NOT NULL,
  "payeeName" TEXT NOT NULL,
  "payeeTaxId" TEXT,
  "payeeBranchCode" VARCHAR(5),
  "paidAt" TIMESTAMP(3) NOT NULL,
  "incomeDescription" TEXT NOT NULL,
  "taxableBaseAmount" DECIMAL(14,2) NOT NULL,
  "withholdingTaxRate" DECIMAL(5,2) NOT NULL,
  "withholdingTaxAmount" DECIMAL(14,2) NOT NULL,
  "status" "WithholdingTaxRecordStatus" NOT NULL DEFAULT 'DRAFT',
  "certificateNumber" TEXT,
  "certificateIssuedAt" TIMESTAMP(3),
  "certificateSnapshot" JSONB,
  "certificateVersion" INTEGER NOT NULL DEFAULT 0,
  "createdByEmployeeId" INTEGER NOT NULL,
  "certifiedByEmployeeId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WithholdingTaxRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WithholdingTaxFilingBatch" (
  "id" TEXT NOT NULL,
  "branchId" INTEGER NOT NULL,
  "taxPeriodId" TEXT NOT NULL,
  "formType" "WithholdingTaxFormType" NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "status" "WithholdingTaxFilingStatus" NOT NULL DEFAULT 'DRAFT',
  "itemCount" INTEGER NOT NULL DEFAULT 0,
  "taxableBaseAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "withholdingTaxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "preparedByEmployeeId" INTEGER,
  "preparedAt" TIMESTAMP(3),
  "submittedByEmployeeId" INTEGER,
  "submittedAt" TIMESTAMP(3),
  "submissionEvidence" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WithholdingTaxFilingBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WithholdingTaxFilingItem" (
  "id" TEXT NOT NULL,
  "branchId" INTEGER NOT NULL,
  "batchId" TEXT NOT NULL,
  "withholdingTaxRecordId" TEXT NOT NULL,
  "taxExpenseId" INTEGER NOT NULL,
  "certificateNumber" TEXT NOT NULL,
  "payeeName" TEXT NOT NULL,
  "payeeTaxId" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "taxableBaseAmount" DECIMAL(14,2) NOT NULL,
  "withholdingTaxRate" DECIMAL(5,2) NOT NULL,
  "withholdingTaxAmount" DECIMAL(14,2) NOT NULL,
  "sourceSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WithholdingTaxFilingItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WithholdingTaxRecord_taxExpenseId_key" ON "WithholdingTaxRecord"("taxExpenseId");
CREATE UNIQUE INDEX "WithholdingTaxRecord_id_branchId_key" ON "WithholdingTaxRecord"("id", "branchId");
CREATE UNIQUE INDEX "WithholdingTaxRecord_branchId_certificateNumber_key" ON "WithholdingTaxRecord"("branchId", "certificateNumber");
CREATE INDEX "WithholdingTaxRecord_branchId_taxPeriodId_formType_status_idx" ON "WithholdingTaxRecord"("branchId", "taxPeriodId", "formType", "status");
CREATE INDEX "WithholdingTaxRecord_branchId_paidAt_idx" ON "WithholdingTaxRecord"("branchId", "paidAt");
CREATE INDEX "WithholdingTaxRecord_payeeTaxId_idx" ON "WithholdingTaxRecord"("payeeTaxId");

CREATE UNIQUE INDEX "WithholdingTaxFilingBatch_branchId_taxPeriodId_formType_key" ON "WithholdingTaxFilingBatch"("branchId", "taxPeriodId", "formType");
CREATE UNIQUE INDEX "WithholdingTaxFilingBatch_id_branchId_key" ON "WithholdingTaxFilingBatch"("id", "branchId");
CREATE INDEX "WithholdingTaxFilingBatch_branchId_year_month_formType_status_idx" ON "WithholdingTaxFilingBatch"("branchId", "year", "month", "formType", "status");

CREATE UNIQUE INDEX "WithholdingTaxFilingItem_withholdingTaxRecordId_key" ON "WithholdingTaxFilingItem"("withholdingTaxRecordId");
CREATE UNIQUE INDEX "WithholdingTaxFilingItem_batchId_withholdingTaxRecordId_key" ON "WithholdingTaxFilingItem"("batchId", "withholdingTaxRecordId");
CREATE INDEX "WithholdingTaxFilingItem_branchId_batchId_idx" ON "WithholdingTaxFilingItem"("branchId", "batchId");
CREATE INDEX "WithholdingTaxFilingItem_taxExpenseId_idx" ON "WithholdingTaxFilingItem"("taxExpenseId");

ALTER TABLE "WithholdingTaxRecord"
  ADD CONSTRAINT "WithholdingTaxRecord_taxExpenseId_branchId_fkey"
  FOREIGN KEY ("taxExpenseId", "branchId") REFERENCES "TaxExpense"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WithholdingTaxRecord"
  ADD CONSTRAINT "WithholdingTaxRecord_taxPeriodId_branchId_fkey"
  FOREIGN KEY ("taxPeriodId", "branchId") REFERENCES "TaxPeriod"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WithholdingTaxFilingBatch"
  ADD CONSTRAINT "WithholdingTaxFilingBatch_taxPeriodId_branchId_fkey"
  FOREIGN KEY ("taxPeriodId", "branchId") REFERENCES "TaxPeriod"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WithholdingTaxFilingItem"
  ADD CONSTRAINT "WithholdingTaxFilingItem_batchId_branchId_fkey"
  FOREIGN KEY ("batchId", "branchId") REFERENCES "WithholdingTaxFilingBatch"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WithholdingTaxFilingItem"
  ADD CONSTRAINT "WithholdingTaxFilingItem_withholdingTaxRecordId_branchId_fkey"
  FOREIGN KEY ("withholdingTaxRecordId", "branchId") REFERENCES "WithholdingTaxRecord"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WithholdingTaxFilingItem"
  ADD CONSTRAINT "WithholdingTaxFilingItem_taxExpenseId_branchId_fkey"
  FOREIGN KEY ("taxExpenseId", "branchId") REFERENCES "TaxExpense"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
