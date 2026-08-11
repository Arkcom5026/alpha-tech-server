CREATE TABLE "RepairSubcontract" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "repairJobId" INTEGER NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'SENT',
  "providerName" TEXT NOT NULL,
  "providerPhone" TEXT,
  "workScope" TEXT NOT NULL,
  "externalReference" TEXT,
  "trackingNumber" TEXT,
  "customerEstimateAmount" DECIMAL(12,2),
  "customerApprovalNote" TEXT,
  "providerQuotedAmount" DECIMAL(12,2),
  "providerQuoteNote" TEXT,
  "customerDecisionNote" TEXT,
  "actualExternalCost" DECIMAL(12,2),
  "resultNote" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedReturnAt" TIMESTAMP(3),
  "returnRequestedAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "sentByEmployeeId" INTEGER NOT NULL,
  "returnedByEmployeeId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepairSubcontract_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RepairSubcontract_status_check"
    CHECK ("status" IN ('SENT', 'RETURN_REQUESTED', 'RETURNED')),
  CONSTRAINT "RepairSubcontract_customerEstimateAmount_check"
    CHECK ("customerEstimateAmount" IS NULL OR "customerEstimateAmount" >= 0),
  CONSTRAINT "RepairSubcontract_providerQuotedAmount_check"
    CHECK ("providerQuotedAmount" IS NULL OR "providerQuotedAmount" >= 0),
  CONSTRAINT "RepairSubcontract_actualExternalCost_check"
    CHECK ("actualExternalCost" IS NULL OR "actualExternalCost" >= 0)
);

CREATE INDEX "RepairSubcontract_branchId_status_sentAt_idx"
  ON "RepairSubcontract"("branchId", "status", "sentAt");

CREATE INDEX "RepairSubcontract_repairJobId_sentAt_idx"
  ON "RepairSubcontract"("repairJobId", "sentAt");

CREATE INDEX "RepairSubcontract_repairJobId_status_idx"
  ON "RepairSubcontract"("repairJobId", "status");

CREATE UNIQUE INDEX "RepairSubcontract_one_active_per_job_key"
  ON "RepairSubcontract"("repairJobId")
  WHERE "status" IN ('SENT', 'RETURN_REQUESTED');
