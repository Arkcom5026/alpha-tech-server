CREATE TABLE "SalePriceAdjustmentEvidence" (
    "id" SERIAL NOT NULL,
    "saleId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "lineId" VARCHAR(160) NOT NULL,
    "lineType" VARCHAR(24) NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "priceAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalPrice" DECIMAL(12,2) NOT NULL,
    "adjustmentReason" TEXT,
    "createdByEmployeeId" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalePriceAdjustmentEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SalePriceAdjustmentEvidence_final_price_nonnegative" CHECK ("finalPrice" >= 0)
);

CREATE UNIQUE INDEX "SalePriceAdjustmentEvidence_saleId_lineId_key"
ON "SalePriceAdjustmentEvidence"("saleId", "lineId");
CREATE INDEX "SalePriceAdjustmentEvidence_branchId_createdAt_idx"
ON "SalePriceAdjustmentEvidence"("branchId", "createdAt");
CREATE INDEX "SalePriceAdjustmentEvidence_saleId_idx"
ON "SalePriceAdjustmentEvidence"("saleId");
CREATE INDEX "SalePriceAdjustmentEvidence_createdByEmployeeId_idx"
ON "SalePriceAdjustmentEvidence"("createdByEmployeeId");

ALTER TABLE "SalePriceAdjustmentEvidence"
ADD CONSTRAINT "SalePriceAdjustmentEvidence_saleId_fkey"
FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalePriceAdjustmentEvidence"
ADD CONSTRAINT "SalePriceAdjustmentEvidence_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalePriceAdjustmentEvidence"
ADD CONSTRAINT "SalePriceAdjustmentEvidence_createdByEmployeeId_fkey"
FOREIGN KEY ("createdByEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
