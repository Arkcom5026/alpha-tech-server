CREATE TYPE "SupplierCapability" AS ENUM ('PROCUREMENT', 'EXPENSE_PAYEE');

CREATE TABLE "SupplierCapabilityAssignment" (
  "id" SERIAL NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "capability" "SupplierCapability" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupplierCapabilityAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierCapabilityAssignment_supplierId_capability_key"
  ON "SupplierCapabilityAssignment"("supplierId", "capability");

CREATE INDEX "SupplierCapabilityAssignment_capability_supplierId_idx"
  ON "SupplierCapabilityAssignment"("capability", "supplierId");

ALTER TABLE "SupplierCapabilityAssignment"
  ADD CONSTRAINT "SupplierCapabilityAssignment_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
