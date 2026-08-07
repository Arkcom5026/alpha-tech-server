CREATE TABLE "SalePriceAdjustmentEvidence" (
    "id" SERIAL NOT NULL,
    "sourceType" VARCHAR(24) NOT NULL,
    "saleId" INTEGER,
    "heldCartId" INTEGER,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalePriceAdjustmentEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SalePriceAdjustmentEvidence_final_price_nonnegative" CHECK ("finalPrice" >= 0),
    CONSTRAINT "SalePriceAdjustmentEvidence_source_type" CHECK ("sourceType" IN ('SALE', 'HELD_CART')),
    CONSTRAINT "SalePriceAdjustmentEvidence_single_source" CHECK (
      ("sourceType" = 'SALE' AND "saleId" IS NOT NULL AND "heldCartId" IS NULL)
      OR
      ("sourceType" = 'HELD_CART' AND "heldCartId" IS NOT NULL AND "saleId" IS NULL)
    )
);

CREATE UNIQUE INDEX "SalePriceAdjustmentEvidence_saleId_lineId_key"
ON "SalePriceAdjustmentEvidence"("saleId", "lineId");
CREATE UNIQUE INDEX "SalePriceAdjustmentEvidence_heldCartId_lineId_key"
ON "SalePriceAdjustmentEvidence"("heldCartId", "lineId");
CREATE INDEX "SalePriceAdjustmentEvidence_branchId_sourceType_createdAt_idx"
ON "SalePriceAdjustmentEvidence"("branchId", "sourceType", "createdAt");
CREATE INDEX "SalePriceAdjustmentEvidence_saleId_idx"
ON "SalePriceAdjustmentEvidence"("saleId");
CREATE INDEX "SalePriceAdjustmentEvidence_heldCartId_idx"
ON "SalePriceAdjustmentEvidence"("heldCartId");
CREATE INDEX "SalePriceAdjustmentEvidence_createdByEmployeeId_idx"
ON "SalePriceAdjustmentEvidence"("createdByEmployeeId");

ALTER TABLE "SalePriceAdjustmentEvidence"
ADD CONSTRAINT "SalePriceAdjustmentEvidence_saleId_fkey"
FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalePriceAdjustmentEvidence"
ADD CONSTRAINT "SalePriceAdjustmentEvidence_heldCartId_fkey"
FOREIGN KEY ("heldCartId") REFERENCES "PosHeldCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalePriceAdjustmentEvidence"
ADD CONSTRAINT "SalePriceAdjustmentEvidence_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalePriceAdjustmentEvidence"
ADD CONSTRAINT "SalePriceAdjustmentEvidence_createdByEmployeeId_fkey"
FOREIGN KEY ("createdByEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
