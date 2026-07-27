-- Quick Receipt hardening: case-insensitive inventory identity and non-negative tax totals.
-- The unique indexes intentionally fail migration when legacy collisions already exist,
-- so data can be reviewed instead of silently preserving ambiguous inventory identity.

CREATE UNIQUE INDEX "StockItem_barcode_ci_unique"
  ON "StockItem" (LOWER("barcode"));

CREATE UNIQUE INDEX "SimpleLot_barcode_ci_unique"
  ON "SimpleLot" (LOWER("barcode"));

CREATE UNIQUE INDEX "StockItem_serialNumber_ci_unique"
  ON "StockItem" (LOWER("serialNumber"))
  WHERE "serialNumber" IS NOT NULL AND BTRIM("serialNumber") <> '';

ALTER TABLE "QuickReceiptSession"
  ADD CONSTRAINT "QuickReceiptSession_document_subtotal_nonnegative"
    CHECK ("documentSubtotal" IS NULL OR "documentSubtotal" >= 0),
  ADD CONSTRAINT "QuickReceiptSession_document_vat_nonnegative"
    CHECK ("documentVatAmount" IS NULL OR "documentVatAmount" >= 0),
  ADD CONSTRAINT "QuickReceiptSession_document_total_nonnegative"
    CHECK ("documentTotalAmount" IS NULL OR "documentTotalAmount" >= 0);
