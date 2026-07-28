ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'RESERVE';

ALTER TABLE "StockBalance"
  ADD CONSTRAINT "StockBalance_reserved_non_negative_check"
  CHECK ("reserved" >= 0),
  ADD CONSTRAINT "StockBalance_reserved_not_over_quantity_check"
  CHECK ("reserved" <= "quantity");

CREATE OR REPLACE FUNCTION prevent_reserved_stock_item_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status"::text = 'SOLD'
     AND OLD."status"::text <> 'SOLD'
     AND EXISTS (
       SELECT 1
       FROM "ProductReservationItem" reservation_item
       WHERE reservation_item."stockItemId" = NEW."id"
         AND reservation_item."isActive" = TRUE
     ) THEN
    RAISE EXCEPTION 'Stock item % is reserved by an active product reservation', NEW."id"
      USING ERRCODE = '23514',
            CONSTRAINT = 'StockItem_active_reservation_sale_guard';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "StockItem_active_reservation_sale_guard" ON "StockItem";
CREATE TRIGGER "StockItem_active_reservation_sale_guard"
BEFORE UPDATE OF "status" ON "StockItem"
FOR EACH ROW
EXECUTE FUNCTION prevent_reserved_stock_item_sale();
