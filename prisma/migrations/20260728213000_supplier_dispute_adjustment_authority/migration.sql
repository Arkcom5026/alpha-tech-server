CREATE TYPE "SupplierPayableDisputeStatus" AS ENUM ('OPEN', 'RESOLVED', 'CANCELLED');
CREATE TYPE "SupplierPayableAdjustmentDirection" AS ENUM ('CREDIT', 'DEBIT');
CREATE TYPE "SupplierPayableAdjustmentStatus" AS ENUM ('CONFIRMED', 'VOIDED');
CREATE TYPE "SupplierPayableAdjustmentType" AS ENUM (
  'CREDIT_NOTE', 'DEBIT_NOTE', 'PRICE_CORRECTION', 'SHORTAGE', 'DAMAGE', 'DISCOUNT', 'OTHER'
);

CREATE TABLE "SupplierPayableDispute" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "payableId" INTEGER NOT NULL,
  "status" "SupplierPayableDisputeStatus" NOT NULL DEFAULT 'OPEN',
  "disputedAmount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "openedById" INTEGER NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedById" INTEGER,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierPayableDispute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierPayableAdjustment" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "payableId" INTEGER NOT NULL,
  "disputeId" INTEGER,
  "code" TEXT NOT NULL,
  "type" "SupplierPayableAdjustmentType" NOT NULL,
  "direction" "SupplierPayableAdjustmentDirection" NOT NULL,
  "status" "SupplierPayableAdjustmentStatus" NOT NULL DEFAULT 'CONFIRMED',
  "amount" DECIMAL(12,2) NOT NULL,
  "documentNumber" TEXT,
  "documentDate" TIMESTAMP(3),
  "note" TEXT,
  "createdById" INTEGER NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedById" INTEGER,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierPayableAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierPayableAdjustment_code_key" ON "SupplierPayableAdjustment"("code");
CREATE INDEX "SupplierPayableDispute_branchId_status_openedAt_idx" ON "SupplierPayableDispute"("branchId", "status", "openedAt");
CREATE INDEX "SupplierPayableDispute_payableId_status_idx" ON "SupplierPayableDispute"("payableId", "status");
CREATE INDEX "SupplierPayableAdjustment_branchId_supplierId_status_idx" ON "SupplierPayableAdjustment"("branchId", "supplierId", "status");
CREATE INDEX "SupplierPayableAdjustment_payableId_status_idx" ON "SupplierPayableAdjustment"("payableId", "status");
CREATE INDEX "SupplierPayableAdjustment_disputeId_idx" ON "SupplierPayableAdjustment"("disputeId");

ALTER TABLE "SupplierPayableDispute" ADD CONSTRAINT "SupplierPayableDispute_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayableDispute" ADD CONSTRAINT "SupplierPayableDispute_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayableDispute" ADD CONSTRAINT "SupplierPayableDispute_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "SupplierPayable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayableDispute" ADD CONSTRAINT "SupplierPayableDispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayableDispute" ADD CONSTRAINT "SupplierPayableDispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayableAdjustment" ADD CONSTRAINT "SupplierPayableAdjustment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayableAdjustment" ADD CONSTRAINT "SupplierPayableAdjustment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayableAdjustment" ADD CONSTRAINT "SupplierPayableAdjustment_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "SupplierPayable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayableAdjustment" ADD CONSTRAINT "SupplierPayableAdjustment_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "SupplierPayableDispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayableAdjustment" ADD CONSTRAINT "SupplierPayableAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayableAdjustment" ADD CONSTRAINT "SupplierPayableAdjustment_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
