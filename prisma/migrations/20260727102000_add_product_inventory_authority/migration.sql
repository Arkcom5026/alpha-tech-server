-- Additive product inventory authority foundation.
CREATE TYPE "ProductInventoryBehavior" AS ENUM ('TRACKED', 'NON_STOCK');

ALTER TABLE "Product"
  ADD COLUMN "inventoryBehavior" "ProductInventoryBehavior" NOT NULL DEFAULT 'TRACKED',
  ADD COLUMN "saleBarcode" TEXT;

CREATE INDEX "Product_mode_inventoryBehavior_active_idx"
  ON "Product"("mode", "inventoryBehavior", "active");

CREATE INDEX "Product_saleBarcode_idx"
  ON "Product"("saleBarcode");
