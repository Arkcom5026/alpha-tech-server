-- Flexible input-tax receipt links.
-- Link rows, not receipt classification metadata, are the allocation authority.

CREATE TYPE "InputTaxReceiptSourceType" AS ENUM ('PO_RECEIPT', 'QUICK_RECEIPT');
CREATE TYPE "InputTaxReceiptLinkState" AS ENUM ('ACTIVE', 'CANCELLED');
CREATE TYPE "InputTaxReceiptLinkEventType" AS ENUM (
  'LINKED',
  'ALLOCATION_CHANGED',
  'CANCELLED',
  'REACTIVATED'
);

ALTER TABLE "PurchaseOrderReceipt"
  ADD COLUMN "deliveryNoteNumber" TEXT,
  ADD COLUMN "deliveryNoteDate" TIMESTAMP(3);

CREATE TABLE "InputTaxDocumentReceiptLink" (
  "id" SERIAL NOT NULL,
  "taxDocumentId" INTEGER NOT NULL,
  "branchId" INTEGER NOT NULL,
  "supplierId" INTEGER NOT NULL,
  "sourceType" "InputTaxReceiptSourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "receiptCode" TEXT NOT NULL,
  "deliveryNoteNumber" TEXT,
  "allocatedSubtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "allocatedVatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "allocatedTotalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "state" "InputTaxReceiptLinkState" NOT NULL DEFAULT 'ACTIVE',
  "linkKey" TEXT NOT NULL,
  "linkedByEmployeeId" INTEGER,
  "cancelledByEmployeeId" INTEGER,
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InputTaxDocumentReceiptLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InputTaxDocumentReceiptLink_taxDocumentId_fkey"
    FOREIGN KEY ("taxDocumentId") REFERENCES "TaxDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InputTaxDocumentReceiptLink_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InputTaxDocumentReceiptLink_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InputTaxDocumentReceiptLink_linkedByEmployeeId_fkey"
    FOREIGN KEY ("linkedByEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InputTaxDocumentReceiptLink_cancelledByEmployeeId_fkey"
    FOREIGN KEY ("cancelledByEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InputTaxDocumentReceiptLink_allocation_nonnegative"
    CHECK (
      "allocatedSubtotal" >= 0
      AND "allocatedVatAmount" >= 0
      AND "allocatedTotalAmount" >= 0
    ),
  CONSTRAINT "InputTaxDocumentReceiptLink_cancelled_shape"
    CHECK (
      ("state" = 'ACTIVE' AND "cancelledAt" IS NULL)
      OR ("state" = 'CANCELLED' AND "cancelledAt" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "InputTaxDocumentReceiptLink_linkKey_key"
  ON "InputTaxDocumentReceiptLink"("linkKey");
CREATE UNIQUE INDEX "InputTaxDocumentReceiptLink_active_document_source_key"
  ON "InputTaxDocumentReceiptLink"("taxDocumentId", "sourceType", "sourceId")
  WHERE "state" = 'ACTIVE';
CREATE INDEX "InputTaxDocumentReceiptLink_active_source_idx"
  ON "InputTaxDocumentReceiptLink"("branchId", "sourceType", "sourceId", "state");
CREATE INDEX "InputTaxDocumentReceiptLink_document_state_idx"
  ON "InputTaxDocumentReceiptLink"("taxDocumentId", "state");
CREATE INDEX "InputTaxDocumentReceiptLink_supplier_state_idx"
  ON "InputTaxDocumentReceiptLink"("branchId", "supplierId", "state");

CREATE TABLE "InputTaxDocumentReceiptLinkEvent" (
  "id" SERIAL NOT NULL,
  "linkId" INTEGER NOT NULL,
  "eventType" "InputTaxReceiptLinkEventType" NOT NULL,
  "actorEmployeeId" INTEGER,
  "reason" TEXT,
  "beforeSnapshot" JSONB,
  "afterSnapshot" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InputTaxDocumentReceiptLinkEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InputTaxDocumentReceiptLinkEvent_linkId_fkey"
    FOREIGN KEY ("linkId") REFERENCES "InputTaxDocumentReceiptLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InputTaxDocumentReceiptLinkEvent_actorEmployeeId_fkey"
    FOREIGN KEY ("actorEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "InputTaxDocumentReceiptLinkEvent_link_occurred_idx"
  ON "InputTaxDocumentReceiptLinkEvent"("linkId", "occurredAt");

