-- Canonical initial authority for the new ProductReservation platform aggregate.
-- It creates only new platform objects and references existing POS tables.

CREATE TYPE "ProductReservationActorType" AS ENUM ('EMPLOYEE', 'COMMERCE_IDENTITY');
CREATE TYPE "ProductReservationStatus" AS ENUM (
  'ACTIVE',
  'ACCEPTED',
  'FULFILLMENT_READY',
  'READY_FOR_PICKUP',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED'
);
CREATE TYPE "ProductReservationLineType" AS ENUM ('STOCK_ITEM', 'SIMPLE');
CREATE TYPE "OnlineOrderSource" AS ENUM ('ONLINE', 'STOREFRONT');
CREATE TYPE "OnlineFulfillmentMethod" AS ENUM ('PICKUP');

CREATE TABLE "ProductReservation" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "branchId" INTEGER NOT NULL,
  "customerId" INTEGER,
  "createdByEmployeeId" INTEGER,
  "actorType" "ProductReservationActorType" NOT NULL DEFAULT 'EMPLOYEE',
  "commerceIdentityId" INTEGER,
  "anonymousSessionId" INTEGER,
  "idempotencyKey" TEXT,
  "status" "ProductReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "orderSource" "OnlineOrderSource" NOT NULL DEFAULT 'ONLINE',
  "sourceReference" TEXT,
  "fulfillmentMethod" "OnlineFulfillmentMethod" NOT NULL DEFAULT 'PICKUP',
  "totalBeforeDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "note" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductReservation_code_key" UNIQUE ("code"),
  CONSTRAINT "ProductReservation_commerce_identity_unique" UNIQUE ("commerceIdentityId"),
  CONSTRAINT "ProductReservation_anonymous_session_unique" UNIQUE ("anonymousSessionId"),
  CONSTRAINT "ProductReservation_amounts_non_negative" CHECK (
    "totalBeforeDiscount" >= 0 AND "totalDiscount" >= 0
    AND "totalAmount" >= 0 AND "depositAmount" >= 0
  ),
  CONSTRAINT "ProductReservation_actor_authority_consistent" CHECK (
    ("actorType" = 'EMPLOYEE' AND "customerId" IS NOT NULL AND "createdByEmployeeId" IS NOT NULL
      AND "commerceIdentityId" IS NULL AND "anonymousSessionId" IS NULL)
    OR
    ("actorType" = 'COMMERCE_IDENTITY' AND "customerId" IS NULL AND "createdByEmployeeId" IS NULL
      AND "commerceIdentityId" IS NOT NULL AND "anonymousSessionId" IS NOT NULL)
  )
);

CREATE TABLE "ProductReservationItem" (
  "id" SERIAL NOT NULL,
  "reservationId" INTEGER NOT NULL,
  "lineId" TEXT NOT NULL,
  "lineType" "ProductReservationLineType" NOT NULL,
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
  CONSTRAINT "ProductReservationItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductReservationItem_reservationId_lineId_key" UNIQUE ("reservationId", "lineId"),
  CONSTRAINT "ProductReservationItem_amounts_non_negative" CHECK (
    "quantity" > 0 AND "basePrice" >= 0 AND "discount" >= 0 AND "price" >= 0 AND "vatAmount" >= 0
  ),
  CONSTRAINT "ProductReservationItem_line_shape" CHECK (
    ("lineType" = 'STOCK_ITEM' AND "stockItemId" IS NOT NULL AND "simpleLotId" IS NULL AND "quantity" = 1)
    OR ("lineType" = 'SIMPLE' AND "stockItemId" IS NULL)
  )
);

ALTER TABLE "ProductReservation"
  ADD CONSTRAINT "ProductReservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductReservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductReservation_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductReservation_commerceIdentityId_fkey" FOREIGN KEY ("commerceIdentityId") REFERENCES "CommerceCommitmentIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductReservation_anonymousSessionId_fkey" FOREIGN KEY ("anonymousSessionId") REFERENCES "AnonymousShoppingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductReservationItem"
  ADD CONSTRAINT "ProductReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "ProductReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductReservationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductReservationItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductReservationItem_simpleLotId_fkey" FOREIGN KEY ("simpleLotId") REFERENCES "SimpleLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ProductReservation_branchId_status_createdAt_idx" ON "ProductReservation"("branchId", "status", "createdAt");
CREATE INDEX "ProductReservation_status_expiresAt_idx" ON "ProductReservation"("status", "expiresAt");
CREATE UNIQUE INDEX "ProductReservation_public_idempotency_unique"
  ON "ProductReservation"("branchId", "idempotencyKey")
  WHERE "actorType" = 'COMMERCE_IDENTITY' AND "idempotencyKey" IS NOT NULL;
CREATE INDEX "ProductReservationItem_reservationId_isActive_idx" ON "ProductReservationItem"("reservationId", "isActive");
CREATE INDEX "ProductReservationItem_productId_idx" ON "ProductReservationItem"("productId");
CREATE INDEX "ProductReservationItem_simpleLotId_idx" ON "ProductReservationItem"("simpleLotId");
CREATE UNIQUE INDEX "ProductReservationItem_active_stock_unique"
  ON "ProductReservationItem"("stockItemId")
  WHERE "stockItemId" IS NOT NULL AND "isActive" = TRUE;
