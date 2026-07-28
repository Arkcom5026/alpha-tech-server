CREATE TYPE "SupplierAdvanceStatus" AS ENUM (
  'REVIEW_REQUIRED',
  'ACTIVE',
  'EXHAUSTED',
  'VOIDED'
);

CREATE TABLE "SupplierAdvance" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "paymentId" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "status" "SupplierAdvanceStatus" NOT NULL DEFAULT 'ACTIVE',
  "originalAmount" DECIMAL(12,2) NOT NULL,
  "availableAmount" DECIMAL(12,2) NOT NULL,
  "legacyImported" BOOLEAN NOT NULL DEFAULT false,
  "createdById" INTEGER NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "activatedById" INTEGER,
  "voidedAt" TIMESTAMP(3),
  "voidedById" INTEGER,
  "voidReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierAdvance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierAdvanceAllocation" (
  "id" SERIAL NOT NULL,
  "advanceId" INTEGER NOT NULL,
  "payableId" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "state" "SupplierPaymentAllocationState" NOT NULL DEFAULT 'ACTIVE',
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedAt" TIMESTAMP(3),
  "reversedById" INTEGER,
  "reversalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierAdvanceAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierAdvance_paymentId_key" ON "SupplierAdvance"("paymentId");
CREATE UNIQUE INDEX "SupplierAdvance_code_key" ON "SupplierAdvance"("code");
CREATE INDEX "SupplierAdvance_branchId_supplierId_status_idx"
  ON "SupplierAdvance"("branchId", "supplierId", "status");
CREATE INDEX "SupplierAdvance_branchId_status_createdAt_idx"
  ON "SupplierAdvance"("branchId", "status", "createdAt");
CREATE INDEX "SupplierAdvanceAllocation_advanceId_state_idx"
  ON "SupplierAdvanceAllocation"("advanceId", "state");
CREATE INDEX "SupplierAdvanceAllocation_payableId_state_idx"
  ON "SupplierAdvanceAllocation"("payableId", "state");

ALTER TABLE "SupplierAdvance"
  ADD CONSTRAINT "SupplierAdvance_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierAdvance"
  ADD CONSTRAINT "SupplierAdvance_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierAdvance"
  ADD CONSTRAINT "SupplierAdvance_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "SupplierPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierAdvance"
  ADD CONSTRAINT "SupplierAdvance_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierAdvance"
  ADD CONSTRAINT "SupplierAdvance_activatedById_fkey"
  FOREIGN KEY ("activatedById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierAdvance"
  ADD CONSTRAINT "SupplierAdvance_voidedById_fkey"
  FOREIGN KEY ("voidedById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierAdvanceAllocation"
  ADD CONSTRAINT "SupplierAdvanceAllocation_advanceId_fkey"
  FOREIGN KEY ("advanceId") REFERENCES "SupplierAdvance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierAdvanceAllocation"
  ADD CONSTRAINT "SupplierAdvanceAllocation_payableId_fkey"
  FOREIGN KEY ("payableId") REFERENCES "SupplierPayable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierAdvanceAllocation"
  ADD CONSTRAINT "SupplierAdvanceAllocation_reversedById_fkey"
  FOREIGN KEY ("reversedById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "SupplierAdvance" (
  "branchId", "supplierId", "paymentId", "code", "status",
  "originalAmount", "availableAmount", "legacyImported", "createdById", "createdAt", "updatedAt"
)
SELECT
  payment."branchId",
  payment."supplierId",
  payment."id",
  'SA-LEGACY-' || payment."id",
  'REVIEW_REQUIRED'::"SupplierAdvanceStatus",
  COALESCE(payment."amount", payment."creditAmount", payment."debitAmount"),
  COALESCE(payment."amount", payment."creditAmount", payment."debitAmount"),
  true,
  payment."employeeId",
  payment."createdAt",
  payment."updatedAt"
FROM "SupplierPayment" payment
WHERE payment."paymentType" = 'ADVANCE'
  AND payment."lifecycleStatus" <> 'VOIDED'
  AND COALESCE(payment."amount", payment."creditAmount", payment."debitAmount", 0) > 0
ON CONFLICT ("paymentId") DO NOTHING;
