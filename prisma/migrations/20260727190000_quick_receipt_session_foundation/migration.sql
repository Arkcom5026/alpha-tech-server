-- Quick Receipt resumable session + tax intake foundation
-- Inventory is created only when the receipt is finalized.

CREATE TABLE "QuickReceiptSession" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "branchId" INTEGER NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "deliveryNoteNumber" TEXT NOT NULL,
  "normalizedDeliveryNoteNumber" TEXT NOT NULL,
  "deliveryNoteDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "note" TEXT,
  "taxDocumentMode" TEXT NOT NULL DEFAULT 'NOT_RECEIVED',
  "supplierTaxInvoiceNumber" TEXT,
  "supplierTaxInvoiceDate" TIMESTAMP(3),
  "taxPricingMode" TEXT,
  "documentSubtotal" DECIMAL(12,2),
  "documentVatAmount" DECIMAL(12,2),
  "documentTotalAmount" DECIMAL(12,2),
  "createdById" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuickReceiptSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QuickReceiptSession_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QuickReceiptSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QuickReceiptSession_status_check" CHECK ("status" IN ('DRAFT','FINALIZING','COMPLETED','CANCELLED')),
  CONSTRAINT "QuickReceiptSession_tax_mode_check" CHECK ("taxDocumentMode" IN ('NOT_RECEIVED','RECEIVED_WITH_GOODS','NON_VAT_DOCUMENT','NO_INPUT_TAX_CLAIM')),
  CONSTRAINT "QuickReceiptSession_tax_pricing_check" CHECK ("taxPricingMode" IS NULL OR "taxPricingMode" IN ('VAT_INCLUDED','VAT_EXCLUDED'))
);

CREATE TABLE "QuickReceiptSessionItem" (
  "id" SERIAL PRIMARY KEY,
  "receiptId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "costPrice" DECIMAL(12,2) NOT NULL,
  "priceRetail" INTEGER NOT NULL,
  "priceWholesale" INTEGER,
  "priceTechnician" INTEGER,
  "priceOnline" INTEGER,
  "note" TEXT,
  "items" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuickReceiptSessionItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "QuickReceiptSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QuickReceiptSessionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QuickReceiptSessionItem_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "QuickReceiptSessionItem_cost_check" CHECK ("costPrice" > 0),
  CONSTRAINT "QuickReceiptSessionItem_retail_check" CHECK ("priceRetail" > 0)
);

CREATE TABLE "QuickReceiptFinalizeCommand" (
  "id" SERIAL PRIMARY KEY,
  "receiptId" INTEGER NOT NULL UNIQUE,
  "branchId" INTEGER NOT NULL,
  "commandKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuickReceiptFinalizeCommand_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "QuickReceiptSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QuickReceiptFinalizeCommand_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "QuickReceiptFinalizeCommand_branch_command_key" UNIQUE ("branchId", "commandKey")
);

CREATE INDEX "QuickReceiptSession_branch_status_updated_idx" ON "QuickReceiptSession"("branchId", "status", "updatedAt");
CREATE INDEX "QuickReceiptSession_supplier_delivery_idx" ON "QuickReceiptSession"("branchId", "supplierId", "normalizedDeliveryNoteNumber");
CREATE INDEX "QuickReceiptSession_delivery_number_idx" ON "QuickReceiptSession"("normalizedDeliveryNoteNumber");
CREATE INDEX "QuickReceiptSessionItem_receipt_idx" ON "QuickReceiptSessionItem"("receiptId");
CREATE UNIQUE INDEX "QuickReceiptSession_active_delivery_unique"
  ON "QuickReceiptSession"("branchId", "supplierId", "normalizedDeliveryNoteNumber")
  WHERE "status" IN ('DRAFT','FINALIZING','COMPLETED');
