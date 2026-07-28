CREATE TYPE "SupplierPaymentLifecycleStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'VOIDED');
CREATE TYPE "SupplierPaymentAllocationState" AS ENUM ('ACTIVE', 'REVERSED');

ALTER TABLE "SupplierPayment"
  ADD COLUMN "lifecycleStatus" "SupplierPaymentLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedById" INTEGER,
  ADD COLUMN "voidReason" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "SupplierPayment"
SET
  "lifecycleStatus" = CASE
    WHEN "statusPayment" = 'CANCELLED' THEN 'VOIDED'::"SupplierPaymentLifecycleStatus"
    ELSE 'CONFIRMED'::"SupplierPaymentLifecycleStatus"
  END,
  "confirmedAt" = CASE WHEN "statusPayment" <> 'CANCELLED' THEN COALESCE("paidAt", "createdAt") END,
  "voidedAt" = CASE WHEN "statusPayment" = 'CANCELLED' THEN "updatedAt" END;

CREATE TABLE "SupplierPaymentAllocation" (
  "id" SERIAL NOT NULL,
  "paymentId" INTEGER NOT NULL,
  "payableId" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "state" "SupplierPaymentAllocationState" NOT NULL DEFAULT 'ACTIVE',
  "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedAt" TIMESTAMP(3),
  "reversedById" INTEGER,
  "reversalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierPaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierPaymentAllocation_paymentId_state_idx"
  ON "SupplierPaymentAllocation"("paymentId", "state");
CREATE INDEX "SupplierPaymentAllocation_payableId_state_idx"
  ON "SupplierPaymentAllocation"("payableId", "state");
CREATE UNIQUE INDEX "SupplierPaymentAllocation_active_payment_payable_key"
  ON "SupplierPaymentAllocation"("paymentId", "payableId")
  WHERE "state" = 'ACTIVE';

ALTER TABLE "SupplierPayment"
  ADD CONSTRAINT "SupplierPayment_voidedById_fkey"
  FOREIGN KEY ("voidedById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPaymentAllocation"
  ADD CONSTRAINT "SupplierPaymentAllocation_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "SupplierPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPaymentAllocation"
  ADD CONSTRAINT "SupplierPaymentAllocation_payableId_fkey"
  FOREIGN KEY ("payableId") REFERENCES "SupplierPayable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPaymentAllocation"
  ADD CONSTRAINT "SupplierPaymentAllocation_reversedById_fkey"
  FOREIGN KEY ("reversedById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "SupplierPaymentAllocation" ("paymentId", "payableId", "amount", "allocatedAt")
SELECT
  legacy_link."paymentId",
  payable_link."payableId",
  SUM(legacy_link."amountPaid")::numeric,
  MIN(payment."paidAt")
FROM "SupplierPaymentReceipt" legacy_link
JOIN "SupplierPayment" payment ON payment."id" = legacy_link."paymentId"
JOIN "SupplierPayableReceiptLink" payable_link ON payable_link."receiptId" = legacy_link."receiptId"
JOIN "SupplierPayable" payable ON payable."id" = payable_link."payableId"
WHERE payment."lifecycleStatus" = 'CONFIRMED'
  AND payable."status" <> 'CANCELLED'
GROUP BY legacy_link."paymentId", payable_link."payableId"
ON CONFLICT DO NOTHING;
