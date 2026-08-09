CREATE TABLE "ConsolidatedDeliveryLine" (
  "id" SERIAL PRIMARY KEY,
  "combinedBillingId" INTEGER NOT NULL,
  "branchId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "sourceSaleId" INTEGER NOT NULL,
  "sourceSaleCode" VARCHAR(100) NOT NULL,
  "sourceDocumentNo" VARCHAR(100) NOT NULL,
  "sourceLineType" VARCHAR(20) NOT NULL,
  "sourceLineId" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(12,2) NOT NULL,
  "sourceUnitPrice" DECIMAL(12,2) NOT NULL,
  "documentUnitPrice" DECIMAL(12,2) NOT NULL,
  "priceAdjustment" DECIMAL(12,2) NOT NULL,
  "adjustmentReason" TEXT,
  "settledAmount" DECIMAL(12,2) NOT NULL,
  "documentAmount" DECIMAL(12,2) NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'DOCUMENTED',
  "sourceSnapshot" JSONB NOT NULL,
  "adjustedById" INTEGER,
  "adjustedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsolidatedDeliveryLine_combinedBillingId_fkey" FOREIGN KEY ("combinedBillingId") REFERENCES "CombinedBillingDocument"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "ConsolidatedDeliveryLine_branchId_sourceLineType_sourceLineId_key" ON "ConsolidatedDeliveryLine"("branchId", "sourceLineType", "sourceLineId");
CREATE INDEX "ConsolidatedDeliveryLine_combinedBillingId_idx" ON "ConsolidatedDeliveryLine"("combinedBillingId");
CREATE INDEX "ConsolidatedDeliveryLine_sourceSaleId_idx" ON "ConsolidatedDeliveryLine"("sourceSaleId");
CREATE INDEX "ConsolidatedDeliveryLine_branchId_customerId_status_idx" ON "ConsolidatedDeliveryLine"("branchId", "customerId", "status");
