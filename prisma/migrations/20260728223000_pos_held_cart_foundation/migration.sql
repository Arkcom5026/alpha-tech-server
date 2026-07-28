CREATE TYPE "PosHeldCartStatus" AS ENUM ('OPEN', 'CONVERTED', 'CANCELLED');
CREATE TYPE "PosHeldCartLineType" AS ENUM ('STOCK_ITEM', 'SIMPLE');

CREATE TABLE "PosHeldCart" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "branchId" INTEGER NOT NULL,
  "customerId" INTEGER,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "note" TEXT,
  "priceType" TEXT NOT NULL DEFAULT 'retail',
  "status" "PosHeldCartStatus" NOT NULL DEFAULT 'OPEN',
  "totalBeforeDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdById" INTEGER NOT NULL,
  "updatedById" INTEGER NOT NULL,
  "cancelledById" INTEGER,
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "convertedAt" TIMESTAMP(3),
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PosHeldCart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PosHeldCartLine" (
  "id" SERIAL NOT NULL,
  "heldCartId" INTEGER NOT NULL,
  "lineKey" TEXT NOT NULL,
  "lineType" "PosHeldCartLineType" NOT NULL,
  "productId" INTEGER NOT NULL,
  "stockItemId" INTEGER,
  "simpleLotId" INTEGER,
  "barcode" TEXT,
  "productName" TEXT NOT NULL,
  "modelName" TEXT,
  "quantity" DECIMAL(12,2) NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "remark" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PosHeldCartLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PosHeldCartLine_shape_check" CHECK (
    ("lineType" = 'STOCK_ITEM' AND "stockItemId" IS NOT NULL AND "simpleLotId" IS NULL AND "quantity" = 1)
    OR
    ("lineType" = 'SIMPLE' AND "stockItemId" IS NULL AND "quantity" > 0)
  )
);

CREATE UNIQUE INDEX "PosHeldCart_code_key" ON "PosHeldCart"("code");
CREATE UNIQUE INDEX "PosHeldCartLine_heldCartId_lineKey_key" ON "PosHeldCartLine"("heldCartId", "lineKey");
CREATE INDEX "PosHeldCart_branchId_status_lastActivityAt_idx" ON "PosHeldCart"("branchId", "status", "lastActivityAt");
CREATE INDEX "PosHeldCart_branchId_customerPhone_status_idx" ON "PosHeldCart"("branchId", "customerPhone", "status");
CREATE INDEX "PosHeldCart_branchId_customerId_status_idx" ON "PosHeldCart"("branchId", "customerId", "status");
CREATE INDEX "PosHeldCartLine_productId_idx" ON "PosHeldCartLine"("productId");
CREATE INDEX "PosHeldCartLine_stockItemId_idx" ON "PosHeldCartLine"("stockItemId");
CREATE INDEX "PosHeldCartLine_simpleLotId_idx" ON "PosHeldCartLine"("simpleLotId");

ALTER TABLE "Sale" ADD COLUMN "sourceHeldCartId" INTEGER;
CREATE UNIQUE INDEX "Sale_sourceHeldCartId_key" ON "Sale"("sourceHeldCartId");

ALTER TABLE "PosHeldCart" ADD CONSTRAINT "PosHeldCart_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosHeldCart" ADD CONSTRAINT "PosHeldCart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosHeldCart" ADD CONSTRAINT "PosHeldCart_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosHeldCart" ADD CONSTRAINT "PosHeldCart_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosHeldCart" ADD CONSTRAINT "PosHeldCart_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosHeldCartLine" ADD CONSTRAINT "PosHeldCartLine_heldCartId_fkey" FOREIGN KEY ("heldCartId") REFERENCES "PosHeldCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PosHeldCartLine" ADD CONSTRAINT "PosHeldCartLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosHeldCartLine" ADD CONSTRAINT "PosHeldCartLine_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosHeldCartLine" ADD CONSTRAINT "PosHeldCartLine_simpleLotId_fkey" FOREIGN KEY ("simpleLotId") REFERENCES "SimpleLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sourceHeldCartId_fkey" FOREIGN KEY ("sourceHeldCartId") REFERENCES "PosHeldCart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
