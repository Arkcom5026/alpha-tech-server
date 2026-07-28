-- Online Commerce Foundation Alignment
-- Additive projection over the existing ProductReservation authority.

CREATE TYPE "OnlineOrderSource" AS ENUM (
  'MARKETPLACE',
  'STOREFRONT',
  'FACEBOOK',
  'LINE',
  'QR',
  'PHONE',
  'OTHER'
);

CREATE TYPE "OnlineFulfillmentMethod" AS ENUM (
  'PICKUP',
  'DELIVERY'
);

CREATE TYPE "OnlineDeliveryFeeMode" AS ENUM (
  'FREE',
  'FIXED',
  'NEGOTIATED'
);

ALTER TABLE "ProductReservation"
  ADD COLUMN "orderSource" "OnlineOrderSource" NOT NULL DEFAULT 'STOREFRONT',
  ADD COLUMN "sourceReference" TEXT,
  ADD COLUMN "fulfillmentMethod" "OnlineFulfillmentMethod" NOT NULL DEFAULT 'PICKUP',
  ADD COLUMN "deliveryFeeMode" "OnlineDeliveryFeeMode",
  ADD COLUMN "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "recipientName" TEXT,
  ADD COLUMN "recipientPhone" TEXT,
  ADD COLUMN "deliveryAddress" TEXT,
  ADD COLUMN "deliveryNote" TEXT;

CREATE INDEX "ProductReservation_branchId_orderSource_createdAt_idx"
  ON "ProductReservation"("branchId", "orderSource", "createdAt");

CREATE INDEX "ProductReservation_branchId_fulfillmentMethod_status_idx"
  ON "ProductReservation"("branchId", "fulfillmentMethod", "status");
