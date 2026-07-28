-- Unified input-tax document classification for PO and Quick receipts.
-- Historical rows without complete tax invoice evidence remain UNCLASSIFIED.

CREATE TYPE "InputTaxDocumentMode" AS ENUM (
  'UNCLASSIFIED',
  'NOT_RECEIVED',
  'RECEIVED',
  'NON_VAT_DOCUMENT',
  'NO_INPUT_TAX_CLAIM'
);

CREATE TYPE "TaxDocumentReceiptSource" AS ENUM ('WITH_GOODS', 'LATER');

ALTER TABLE "PurchaseOrderReceipt"
  ADD COLUMN "taxDocumentMode" "InputTaxDocumentMode" NOT NULL DEFAULT 'UNCLASSIFIED',
  ADD COLUMN "taxDocumentReceivedAt" TIMESTAMP(3),
  ADD COLUMN "taxDocumentReceiptSource" "TaxDocumentReceiptSource";

UPDATE "PurchaseOrderReceipt"
SET "taxDocumentMode" = 'RECEIVED',
    "taxDocumentReceivedAt" = COALESCE("supplierTaxInvoiceDate", "updatedAt")
WHERE NULLIF(BTRIM("supplierTaxInvoiceNumber"), '') IS NOT NULL
  AND "supplierTaxInvoiceDate" IS NOT NULL;

ALTER TABLE "QuickReceiptSession"
  ADD COLUMN "taxDocumentReceivedAt" TIMESTAMP(3),
  ADD COLUMN "taxDocumentReceiptSource" "TaxDocumentReceiptSource";

UPDATE "QuickReceiptSession"
SET "taxDocumentReceivedAt" = COALESCE("supplierTaxInvoiceDate", "updatedAt"),
    "taxDocumentReceiptSource" = 'WITH_GOODS'
WHERE "taxDocumentMode" = 'RECEIVED_WITH_GOODS'
  AND NULLIF(BTRIM("supplierTaxInvoiceNumber"), '') IS NOT NULL
  AND "supplierTaxInvoiceDate" IS NOT NULL;

ALTER TABLE "QuickReceiptSession"
  DROP CONSTRAINT IF EXISTS "QuickReceiptSession_tax_mode_check",
  ALTER COLUMN "taxDocumentMode" DROP DEFAULT,
  ALTER COLUMN "taxDocumentMode" TYPE "InputTaxDocumentMode"
    USING (
      CASE
        WHEN "taxDocumentMode" = 'RECEIVED_WITH_GOODS'
          AND NULLIF(BTRIM("supplierTaxInvoiceNumber"), '') IS NOT NULL
          AND "supplierTaxInvoiceDate" IS NOT NULL
          THEN 'RECEIVED'
        WHEN "taxDocumentMode" = 'NON_VAT_DOCUMENT' THEN 'NON_VAT_DOCUMENT'
        WHEN "taxDocumentMode" = 'NO_INPUT_TAX_CLAIM' THEN 'NO_INPUT_TAX_CLAIM'
        ELSE 'UNCLASSIFIED'
      END
    )::"InputTaxDocumentMode",
  ALTER COLUMN "taxDocumentMode" SET DEFAULT 'UNCLASSIFIED';

ALTER TABLE "PurchaseOrderReceipt"
  ADD CONSTRAINT "PurchaseOrderReceipt_received_tax_document_check"
  CHECK (
    "taxDocumentMode" <> 'RECEIVED'
    OR (
      NULLIF(BTRIM("supplierTaxInvoiceNumber"), '') IS NOT NULL
      AND "supplierTaxInvoiceDate" IS NOT NULL
    )
  );

ALTER TABLE "QuickReceiptSession"
  ADD CONSTRAINT "QuickReceiptSession_received_tax_document_check"
  CHECK (
    "taxDocumentMode" <> 'RECEIVED'
    OR (
      NULLIF(BTRIM("supplierTaxInvoiceNumber"), '') IS NOT NULL
      AND "supplierTaxInvoiceDate" IS NOT NULL
    )
  );

CREATE INDEX "PurchaseOrderReceipt_branch_tax_mode_received_idx"
  ON "PurchaseOrderReceipt"("branchId", "taxDocumentMode", "receivedAt");

CREATE INDEX "QuickReceiptSession_branch_tax_mode_completed_idx"
  ON "QuickReceiptSession"("branchId", "taxDocumentMode", "completedAt");
