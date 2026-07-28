CREATE TYPE "SupplierPayableStatus" AS ENUM (
  'DRAFT',
  'OPEN',
  'PARTIALLY_PAID',
  'PAID',
  'DISPUTED',
  'CANCELLED'
);

CREATE TABLE "SupplierPayable" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "status" "SupplierPayableStatus" NOT NULL DEFAULT 'OPEN',
  "documentNumber" TEXT,
  "documentDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "currency" TEXT NOT NULL DEFAULT 'THB',
  "subtotalAmount" DECIMAL(12,2),
  "taxAmount" DECIMAL(12,2),
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "note" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierPayable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierPayableReceiptLink" (
  "id" SERIAL NOT NULL,
  "payableId" INTEGER NOT NULL,
  "receiptId" INTEGER NOT NULL,
  "allocatedAmount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierPayableReceiptLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierPayable_code_key" ON "SupplierPayable"("code");
CREATE INDEX "SupplierPayable_branchId_status_dueDate_idx" ON "SupplierPayable"("branchId", "status", "dueDate");
CREATE INDEX "SupplierPayable_branchId_supplierId_status_idx" ON "SupplierPayable"("branchId", "supplierId", "status");
CREATE UNIQUE INDEX "SupplierPayableReceiptLink_payableId_receiptId_key"
  ON "SupplierPayableReceiptLink"("payableId", "receiptId");
CREATE INDEX "SupplierPayableReceiptLink_receiptId_idx" ON "SupplierPayableReceiptLink"("receiptId");

ALTER TABLE "SupplierPayable"
  ADD CONSTRAINT "SupplierPayable_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayable"
  ADD CONSTRAINT "SupplierPayable_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayable"
  ADD CONSTRAINT "SupplierPayable_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayableReceiptLink"
  ADD CONSTRAINT "SupplierPayableReceiptLink_payableId_fkey"
  FOREIGN KEY ("payableId") REFERENCES "SupplierPayable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayableReceiptLink"
  ADD CONSTRAINT "SupplierPayableReceiptLink_receiptId_fkey"
  FOREIGN KEY ("receiptId") REFERENCES "PurchaseOrderReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
