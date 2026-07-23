-- This migration is intentionally atomic.
-- If any compatibility preflight or schema operation fails, PostgreSQL rolls back every change.
BEGIN;

-- Fail before changing schema if the expected source constraint is missing or legacy
-- return rows would violate the new compound uniqueness invariants.
DO $$
BEGIN
  IF to_regclass('public."SaleItem_stockItemId_key"') IS NULL THEN
    RAISE EXCEPTION
      'Expected unique index public."SaleItem_stockItemId_key" was not found; inspect schema drift before applying this migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "public"."SaleReturnItem"
    GROUP BY "saleReturnId", "saleItemId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate SaleReturnItem(saleReturnId, saleItemId) rows must be reconciled before applying this migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "public"."SaleReturnItemSimple"
    GROUP BY "saleReturnId", "saleItemSimpleId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate SaleReturnItemSimple(saleReturnId, saleItemSimpleId) rows must be reconciled before applying this migration';
  END IF;
END
$$;

-- Extend the return lifecycle without reinterpreting existing return statuses.
ALTER TYPE "public"."SaleReturnStatus" ADD VALUE IF NOT EXISTS 'STOCK_RESTORED' BEFORE 'REJECTED';
ALTER TYPE "public"."SaleReturnStatus" ADD VALUE IF NOT EXISTS 'COMPLETED' BEFORE 'REJECTED';

-- Remove only the uniqueness that prevents a serialized stock item from being sold again.
DROP INDEX "public"."SaleItem_stockItemId_key";

-- Add current return projections. Constant defaults preserve all existing rows.
ALTER TABLE "public"."SaleItem"
  ADD COLUMN "returnedQuantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "lastReturnedAt" TIMESTAMP(3);

ALTER TABLE "public"."SaleItemSimple"
  ADD COLUMN "returnedQuantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "lastReturnedAt" TIMESTAMP(3);

-- Legacy SaleReturnItemSimple rows have no authoritative returned quantity.
-- Keep this column nullable during the compatibility phase rather than inventing history.
ALTER TABLE "public"."SaleReturnItemSimple"
  ADD COLUMN "quantity" DECIMAL(12,2);

ALTER TABLE "public"."SaleReturn"
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "stockRestoredAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);

ALTER TABLE "public"."RefundTransaction"
  ADD COLUMN "sourcePaymentItemId" INTEGER,
  ADD COLUMN "referenceNo" TEXT;

-- Add serialized movement authority without fabricating identity or historical statuses.
ALTER TABLE "public"."StockMovement"
  ADD COLUMN "stockItemId" INTEGER,
  ADD COLUMN "previousStockStatus" "public"."StockStatus",
  ADD COLUMN "resultingStockStatus" "public"."StockStatus",
  ADD COLUMN "performedByEmployeeId" INTEGER,
  ADD COLUMN "occurredAt" TIMESTAMP(3);

-- createdAt is the only authoritative timestamp available for every legacy movement.
UPDATE "public"."StockMovement"
SET "occurredAt" = "createdAt"
WHERE "occurredAt" IS NULL;

ALTER TABLE "public"."StockMovement"
  ALTER COLUMN "occurredAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "occurredAt" SET NOT NULL;

CREATE TABLE "public"."SaleReturnCompletionCommand" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "commandKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "saleReturnId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaleReturnCompletionCommand_pkey" PRIMARY KEY ("id")
);

-- Regular index creation is used inside the transaction so the migration is all-or-nothing.
-- Run this migration during a controlled deployment window.
CREATE INDEX "SaleItem_stockItemId_idx"
  ON "public"."SaleItem"("stockItemId");
CREATE INDEX "SaleReturnItem_saleReturnId_idx"
  ON "public"."SaleReturnItem"("saleReturnId");
CREATE INDEX "SaleReturnItem_saleItemId_idx"
  ON "public"."SaleReturnItem"("saleItemId");
CREATE UNIQUE INDEX "SaleReturnItem_saleReturnId_saleItemId_key"
  ON "public"."SaleReturnItem"("saleReturnId", "saleItemId");
CREATE INDEX "SaleReturnItemSimple_saleReturnId_idx"
  ON "public"."SaleReturnItemSimple"("saleReturnId");
CREATE INDEX "SaleReturnItemSimple_saleItemSimpleId_idx"
  ON "public"."SaleReturnItemSimple"("saleItemSimpleId");
CREATE UNIQUE INDEX "SaleReturnItemSimple_saleReturnId_saleItemSimpleId_key"
  ON "public"."SaleReturnItemSimple"("saleReturnId", "saleItemSimpleId");
CREATE INDEX "StockMovement_stockItemId_occurredAt_idx"
  ON "public"."StockMovement"("stockItemId", "occurredAt");
CREATE INDEX "StockMovement_simpleLotId_occurredAt_idx"
  ON "public"."StockMovement"("simpleLotId", "occurredAt");
CREATE INDEX "StockMovement_branchId_type_occurredAt_idx"
  ON "public"."StockMovement"("branchId", "type", "occurredAt");
CREATE INDEX "StockMovement_productId_branchId_occurredAt_idx"
  ON "public"."StockMovement"("productId", "branchId", "occurredAt");
CREATE INDEX "SaleReturn_saleId_returnedAt_idx"
  ON "public"."SaleReturn"("saleId", "returnedAt");
CREATE INDEX "SaleReturn_branchId_returnedAt_idx"
  ON "public"."SaleReturn"("branchId", "returnedAt");
CREATE INDEX "SaleReturn_branchId_status_returnedAt_idx"
  ON "public"."SaleReturn"("branchId", "status", "returnedAt");
CREATE INDEX "RefundTransaction_saleReturnId_idx"
  ON "public"."RefundTransaction"("saleReturnId");
CREATE INDEX "RefundTransaction_sourcePaymentItemId_idx"
  ON "public"."RefundTransaction"("sourcePaymentItemId");
CREATE INDEX "RefundTransaction_branchId_refundedAt_idx"
  ON "public"."RefundTransaction"("branchId", "refundedAt");
CREATE UNIQUE INDEX "SaleReturnCompletionCommand_saleReturnId_key"
  ON "public"."SaleReturnCompletionCommand"("saleReturnId");
CREATE UNIQUE INDEX "SaleReturnCompletionCommand_branchId_commandKey_key"
  ON "public"."SaleReturnCompletionCommand"("branchId", "commandKey");
CREATE INDEX "SaleReturnCompletionCommand_branchId_createdAt_idx"
  ON "public"."SaleReturnCompletionCommand"("branchId", "createdAt");

-- Add new optional evidence relations as NOT VALID first to reduce the initial lock window.
ALTER TABLE "public"."StockMovement"
  ADD CONSTRAINT "StockMovement_stockItemId_fkey"
  FOREIGN KEY ("stockItemId") REFERENCES "public"."StockItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "public"."StockMovement"
  ADD CONSTRAINT "StockMovement_performedByEmployeeId_fkey"
  FOREIGN KEY ("performedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "public"."RefundTransaction"
  ADD CONSTRAINT "RefundTransaction_sourcePaymentItemId_fkey"
  FOREIGN KEY ("sourcePaymentItemId") REFERENCES "public"."PaymentItem"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "public"."StockMovement"
  VALIDATE CONSTRAINT "StockMovement_stockItemId_fkey";
ALTER TABLE "public"."StockMovement"
  VALIDATE CONSTRAINT "StockMovement_performedByEmployeeId_fkey";
ALTER TABLE "public"."RefundTransaction"
  VALIDATE CONSTRAINT "RefundTransaction_sourcePaymentItemId_fkey";

ALTER TABLE "public"."SaleReturnCompletionCommand"
  ADD CONSTRAINT "SaleReturnCompletionCommand_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."SaleReturnCompletionCommand"
  ADD CONSTRAINT "SaleReturnCompletionCommand_saleReturnId_fkey"
  FOREIGN KEY ("saleReturnId") REFERENCES "public"."SaleReturn"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
