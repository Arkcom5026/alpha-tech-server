CREATE TABLE "ProductReservation" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "branchId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "createdByEmployeeId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "totalBeforeDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "note" TEXT,
  "pickupAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "convertedSaleId" INTEGER UNIQUE,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductReservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProductReservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProductReservation_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProductReservation_convertedSaleId_fkey" FOREIGN KEY ("convertedSaleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProductReservation_status_check" CHECK ("status" IN ('ACTIVE','PARTIALLY_PAID','READY_FOR_PICKUP','COMPLETED','CANCELLED','EXPIRED')),
  CONSTRAINT "ProductReservation_amounts_check" CHECK ("totalBeforeDiscount" >= 0 AND "totalDiscount" >= 0 AND "totalAmount" >= 0 AND "depositAmount" >= 0)
);

CREATE TABLE "ProductReservationItem" (
  "id" SERIAL PRIMARY KEY,
  "reservationId" INTEGER NOT NULL,
  "lineId" TEXT NOT NULL,
  "lineType" TEXT NOT NULL,
  "productId" INTEGER NOT NULL,
  "stockItemId" INTEGER,
  "simpleLotId" INTEGER,
  "quantity" DECIMAL(12,2) NOT NULL,
  "basePrice" DECIMAL(12,2) NOT NULL,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "price" DECIMAL(12,2) NOT NULL,
  "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "remark" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "ProductReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductReservationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProductReservationItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProductReservationItem_simpleLotId_fkey" FOREIGN KEY ("simpleLotId") REFERENCES "SimpleLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProductReservationItem_line_type_check" CHECK ("lineType" IN ('STOCK_ITEM','SIMPLE')),
  CONSTRAINT "ProductReservationItem_shape_check" CHECK (("lineType" = 'STOCK_ITEM' AND "stockItemId" IS NOT NULL AND "simpleLotId" IS NULL AND "quantity" = 1) OR ("lineType" = 'SIMPLE' AND "stockItemId" IS NULL AND "quantity" > 0)),
  CONSTRAINT "ProductReservationItem_amounts_check" CHECK ("basePrice" >= 0 AND "discount" >= 0 AND "price" >= 0 AND "vatAmount" >= 0),
  CONSTRAINT "ProductReservationItem_reservation_line_unique" UNIQUE ("reservationId", "lineId")
);

CREATE INDEX "ProductReservation_branch_status_created_idx" ON "ProductReservation"("branchId", "status", "createdAt");
CREATE INDEX "ProductReservation_customer_created_idx" ON "ProductReservation"("customerId", "createdAt");
CREATE INDEX "ProductReservation_expiry_idx" ON "ProductReservation"("status", "expiresAt");
CREATE INDEX "ProductReservationItem_reservation_idx" ON "ProductReservationItem"("reservationId");
CREATE INDEX "ProductReservationItem_product_idx" ON "ProductReservationItem"("productId");
CREATE INDEX "ProductReservationItem_simple_lot_idx" ON "ProductReservationItem"("simpleLotId");
CREATE UNIQUE INDEX "ProductReservationItem_active_stock_unique"
  ON "ProductReservationItem"("stockItemId")
  WHERE "stockItemId" IS NOT NULL AND "isActive" = TRUE;