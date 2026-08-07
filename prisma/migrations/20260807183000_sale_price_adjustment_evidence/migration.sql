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

CREATE OR REPLACE FUNCTION "capture_sale_item_price_adjustment"()
RETURNS TRIGGER AS $$
DECLARE
  sale_branch_id INTEGER;
  sale_employee_id INTEGER;
BEGIN
  SELECT "branchId", "employeeId"
  INTO sale_branch_id, sale_employee_id
  FROM "Sale"
  WHERE "id" = NEW."saleId";

  INSERT INTO "SalePriceAdjustmentEvidence" (
    "sourceType", "saleId", "branchId", "lineId", "lineType", "basePrice",
    "priceAdjustment", "finalPrice", "adjustmentReason", "createdByEmployeeId"
  ) VALUES (
    'SALE', NEW."saleId", sale_branch_id, 'SALE_ITEM-' || NEW."id"::text, 'STOCK_ITEM',
    NEW."basePrice", NEW."price" - NEW."basePrice", NEW."price",
    NULLIF(BTRIM(COALESCE(NEW."remark", '')), ''), sale_employee_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "capture_sale_item_simple_price_adjustment"()
RETURNS TRIGGER AS $$
DECLARE
  sale_branch_id INTEGER;
  sale_employee_id INTEGER;
BEGIN
  SELECT "branchId", "employeeId"
  INTO sale_branch_id, sale_employee_id
  FROM "Sale"
  WHERE "id" = NEW."saleId";

  INSERT INTO "SalePriceAdjustmentEvidence" (
    "sourceType", "saleId", "branchId", "lineId", "lineType", "basePrice",
    "priceAdjustment", "finalPrice", "adjustmentReason", "createdByEmployeeId"
  ) VALUES (
    'SALE', NEW."saleId", sale_branch_id, 'SALE_ITEM_SIMPLE-' || NEW."id"::text, 'SIMPLE',
    NEW."basePrice", NEW."price" - NEW."basePrice", NEW."price",
    NULLIF(BTRIM(COALESCE(NEW."remark", '')), ''), sale_employee_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SaleItem_capture_price_adjustment"
AFTER INSERT ON "SaleItem"
FOR EACH ROW EXECUTE FUNCTION "capture_sale_item_price_adjustment"();

CREATE TRIGGER "SaleItemSimple_capture_price_adjustment"
AFTER INSERT ON "SaleItemSimple"
FOR EACH ROW EXECUTE FUNCTION "capture_sale_item_simple_price_adjustment"();
