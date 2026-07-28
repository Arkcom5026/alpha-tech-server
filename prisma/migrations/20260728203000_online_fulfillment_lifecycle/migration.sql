-- Online Fulfillment Lifecycle
-- Additive lifecycle values for delivery orders.
-- ProductReservationStatus remains the single status authority.

ALTER TYPE "ProductReservationStatus" ADD VALUE IF NOT EXISTS 'READY_TO_SHIP';
ALTER TYPE "ProductReservationStatus" ADD VALUE IF NOT EXISTS 'SHIPPING';
ALTER TYPE "ProductReservationStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';

CREATE INDEX IF NOT EXISTS "ProductReservation_branchId_fulfillmentMethod_status_updatedAt_idx"
  ON "ProductReservation"("branchId", "fulfillmentMethod", "status", "updatedAt");
