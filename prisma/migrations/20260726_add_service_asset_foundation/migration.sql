-- CreateEnum
CREATE TYPE "public"."ServiceAssetSource" AS ENUM ('SOLD_BY_BRANCH', 'EXTERNAL_CUSTOMER', 'MANUAL_IMPORT');

-- CreateEnum
CREATE TYPE "public"."ServiceAssetStatus" AS ENUM ('ACTIVE', 'IN_SERVICE', 'IN_CLAIM', 'RETURNED_TO_CUSTOMER', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."ServiceAssetImageKind" AS ENUM ('GENERAL', 'INTAKE_CONDITION', 'SERIAL_LABEL', 'ACCESSORY', 'DAMAGE', 'WARRANTY_DOCUMENT');

-- CreateEnum
CREATE TYPE "public"."TaxDocumentType" AS ENUM ('TAX_INVOICE', 'ABBREVIATED_TAX_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'REPLACEMENT', 'VOID');

-- CreateEnum
CREATE TYPE "public"."TaxLifecycleStatus" AS ENUM ('DRAFT', 'VALIDATED', 'ISSUED', 'REPORTED', 'LOCKED', 'CANCELLED', 'REPLACED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."TaxSourceType" AS ENUM ('SALE', 'SALE_RETURN', 'PURCHASE_RECEIPT', 'REPAIR', 'WARRANTY_CLAIM', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."TaxEventType" AS ENUM ('CREATED', 'VALIDATED', 'ISSUED', 'REPORTED', 'LOCKED', 'CANCELLED', 'REPLACED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."TaxLedgerType" AS ENUM ('OUTPUT_VAT', 'INPUT_VAT', 'OUTPUT_VAT_ADJUSTMENT', 'INPUT_VAT_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."TaxPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED', 'SUBMITTED', 'REOPENED');




-- AlterTable
ALTER TABLE "public"."InputTaxFilingItem" ADD COLUMN     "migratedAt" TIMESTAMP(3),
ADD COLUMN     "migrationVersion" INTEGER,
ADD COLUMN     "taxDocumentId" TEXT;


-- AlterTable
ALTER TABLE "public"."RepairJob" ADD COLUMN     "serviceAssetId" INTEGER;

-- AlterTable
ALTER TABLE "public"."SalesTaxFilingItem" ADD COLUMN     "migratedAt" TIMESTAMP(3),
ADD COLUMN     "migrationVersion" INTEGER,
ADD COLUMN     "taxDocumentId" TEXT;

-- AlterTable
ALTER TABLE "public"."WarrantyClaim" ADD COLUMN     "serviceAssetId" INTEGER;

-- CreateTable
CREATE TABLE "public"."ServiceAsset" (
    "id" SERIAL NOT NULL,
    "assetNo" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "sourceStockItemId" INTEGER,
    "productId" INTEGER,
    "productTypeId" INTEGER,
    "brandId" INTEGER,
    "createdByEmployeeId" INTEGER,
    "source" "public"."ServiceAssetSource" NOT NULL DEFAULT 'EXTERNAL_CUSTOMER',
    "status" "public"."ServiceAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "deviceType" TEXT NOT NULL,
    "brandNameSnapshot" TEXT,
    "modelName" TEXT NOT NULL,
    "serialNumber" TEXT,
    "customerAssetTag" TEXT,
    "color" TEXT,
    "description" TEXT,
    "accessories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "physicalCondition" TEXT,
    "accessInstructions" TEXT,
    "purchaseSource" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "externalWarrantyUntil" TIMESTAMP(3),
    "externalWarrantyNote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ServiceAssetImage" (
    "id" SERIAL NOT NULL,
    "serviceAssetId" INTEGER NOT NULL,
    "publicId" TEXT,
    "url" TEXT NOT NULL,
    "secureUrl" TEXT,
    "caption" TEXT,
    "kind" "public"."ServiceAssetImageKind" NOT NULL DEFAULT 'GENERAL',
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAssetImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaxDocument" (
    "id" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,
    "documentNumber" TEXT,
    "documentType" "public"."TaxDocumentType" NOT NULL,
    "status" "public"."TaxLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "validatedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "replacementOfId" TEXT,
    "cancelledDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaxDocumentSource" (
    "id" TEXT NOT NULL,
    "taxDocumentId" TEXT NOT NULL,
    "sourceType" "public"."TaxSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxDocumentSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaxDocumentEvent" (
    "id" TEXT NOT NULL,
    "taxDocumentId" TEXT NOT NULL,
    "eventType" "public"."TaxEventType" NOT NULL,
    "performedBy" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxDocumentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaxSnapshot" (
    "id" TEXT NOT NULL,
    "taxDocumentId" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "sellerTaxId" TEXT,
    "buyerName" TEXT,
    "buyerTaxId" TEXT,
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "vatTotal" DECIMAL(18,2) NOT NULL,
    "grandTotal" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaxSnapshotItem" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL,
    "taxBase" DECIMAL(18,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "vatAmount" DECIMAL(18,2) NOT NULL,
    "grandTotal" DECIMAL(18,2) NOT NULL,
    "productCode" TEXT,
    "unitName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxSnapshotItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaxLedgerEntry" (
    "id" TEXT NOT NULL,
    "taxDocumentId" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,
    "taxPeriodId" TEXT,
    "ledgerType" "public"."TaxLedgerType" NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reportingDate" TIMESTAMP(3),
    "taxBase" DECIMAL(18,2) NOT NULL,
    "vatAmount" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaxPeriod" (
    "id" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,
    "periodCode" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."TaxPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAsset_sourceStockItemId_key" ON "public"."ServiceAsset"("sourceStockItemId");

-- CreateIndex
CREATE INDEX "ServiceAsset_branchId_customerId_status_idx" ON "public"."ServiceAsset"("branchId", "customerId", "status");

-- CreateIndex
CREATE INDEX "ServiceAsset_customerId_updatedAt_idx" ON "public"."ServiceAsset"("customerId", "updatedAt");

-- CreateIndex
CREATE INDEX "ServiceAsset_productId_idx" ON "public"."ServiceAsset"("productId");

-- CreateIndex
CREATE INDEX "ServiceAsset_productTypeId_idx" ON "public"."ServiceAsset"("productTypeId");

-- CreateIndex
CREATE INDEX "ServiceAsset_brandId_idx" ON "public"."ServiceAsset"("brandId");

-- CreateIndex
CREATE INDEX "ServiceAsset_createdByEmployeeId_idx" ON "public"."ServiceAsset"("createdByEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAsset_branchId_assetNo_key" ON "public"."ServiceAsset"("branchId", "assetNo");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAsset_branchId_serialNumber_key" ON "public"."ServiceAsset"("branchId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAssetImage_publicId_key" ON "public"."ServiceAssetImage"("publicId");

-- CreateIndex
CREATE INDEX "ServiceAssetImage_serviceAssetId_active_idx" ON "public"."ServiceAssetImage"("serviceAssetId", "active");

-- CreateIndex
CREATE INDEX "ServiceAssetImage_serviceAssetId_kind_idx" ON "public"."ServiceAssetImage"("serviceAssetId", "kind");

-- CreateIndex
CREATE INDEX "TaxDocument_status_idx" ON "public"."TaxDocument"("status");

-- CreateIndex
CREATE INDEX "TaxDocument_issuedAt_idx" ON "public"."TaxDocument"("issuedAt");

-- CreateIndex
CREATE INDEX "TaxDocument_branchId_status_idx" ON "public"."TaxDocument"("branchId", "status");

-- CreateIndex
CREATE INDEX "TaxDocument_documentType_status_idx" ON "public"."TaxDocument"("documentType", "status");

-- CreateIndex
CREATE INDEX "TaxDocument_replacementOfId_idx" ON "public"."TaxDocument"("replacementOfId");

-- CreateIndex
CREATE INDEX "TaxDocument_cancelledDocumentId_idx" ON "public"."TaxDocument"("cancelledDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxDocument_branchId_documentNumber_key" ON "public"."TaxDocument"("branchId", "documentNumber");

-- CreateIndex
CREATE INDEX "TaxDocumentSource_taxDocumentId_idx" ON "public"."TaxDocumentSource"("taxDocumentId");

-- CreateIndex
CREATE INDEX "TaxDocumentSource_sourceType_sourceId_idx" ON "public"."TaxDocumentSource"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxDocumentSource_taxDocumentId_sourceType_sourceId_key" ON "public"."TaxDocumentSource"("taxDocumentId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "TaxDocumentEvent_taxDocumentId_performedAt_idx" ON "public"."TaxDocumentEvent"("taxDocumentId", "performedAt");

-- CreateIndex
CREATE INDEX "TaxDocumentEvent_eventType_performedAt_idx" ON "public"."TaxDocumentEvent"("eventType", "performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaxSnapshot_taxDocumentId_key" ON "public"."TaxSnapshot"("taxDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxSnapshotItem_snapshotId_lineNo_key" ON "public"."TaxSnapshotItem"("snapshotId", "lineNo");

-- CreateIndex
CREATE INDEX "TaxLedgerEntry_branchId_postingDate_idx" ON "public"."TaxLedgerEntry"("branchId", "postingDate");

-- CreateIndex
CREATE INDEX "TaxLedgerEntry_ledgerType_postingDate_idx" ON "public"."TaxLedgerEntry"("ledgerType", "postingDate");

-- CreateIndex
CREATE INDEX "TaxLedgerEntry_reportingDate_idx" ON "public"."TaxLedgerEntry"("reportingDate");

-- CreateIndex
CREATE INDEX "TaxLedgerEntry_taxPeriodId_idx" ON "public"."TaxLedgerEntry"("taxPeriodId");

-- CreateIndex
CREATE INDEX "TaxLedgerEntry_taxPeriodId_ledgerType_idx" ON "public"."TaxLedgerEntry"("taxPeriodId", "ledgerType");

-- CreateIndex
CREATE UNIQUE INDEX "TaxLedgerEntry_taxDocumentId_ledgerType_key" ON "public"."TaxLedgerEntry"("taxDocumentId", "ledgerType");

-- CreateIndex
CREATE INDEX "TaxPeriod_branchId_status_idx" ON "public"."TaxPeriod"("branchId", "status");

-- CreateIndex
CREATE INDEX "TaxPeriod_startDate_endDate_idx" ON "public"."TaxPeriod"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "TaxPeriod_branchId_periodCode_key" ON "public"."TaxPeriod"("branchId", "periodCode");


-- CreateIndex
CREATE INDEX "InputTaxFilingItem_taxDocumentId_idx" ON "public"."InputTaxFilingItem"("taxDocumentId");


-- CreateIndex
CREATE INDEX "RepairJob_serviceAssetId_idx" ON "public"."RepairJob"("serviceAssetId");

-- CreateIndex
CREATE INDEX "SalesTaxFilingItem_taxDocumentId_idx" ON "public"."SalesTaxFilingItem"("taxDocumentId");

-- CreateIndex
CREATE INDEX "WarrantyClaim_serviceAssetId_openedAt_idx" ON "public"."WarrantyClaim"("serviceAssetId", "openedAt");

-- AddForeignKey
ALTER TABLE "public"."SalesTaxFilingItem" ADD CONSTRAINT "SalesTaxFilingItem_taxDocumentId_fkey" FOREIGN KEY ("taxDocumentId") REFERENCES "public"."TaxDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InputTaxFilingItem" ADD CONSTRAINT "InputTaxFilingItem_taxDocumentId_fkey" FOREIGN KEY ("taxDocumentId") REFERENCES "public"."TaxDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceAsset" ADD CONSTRAINT "ServiceAsset_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceAsset" ADD CONSTRAINT "ServiceAsset_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceAsset" ADD CONSTRAINT "ServiceAsset_sourceStockItemId_fkey" FOREIGN KEY ("sourceStockItemId") REFERENCES "public"."StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceAsset" ADD CONSTRAINT "ServiceAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceAsset" ADD CONSTRAINT "ServiceAsset_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "public"."ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceAsset" ADD CONSTRAINT "ServiceAsset_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceAsset" ADD CONSTRAINT "ServiceAsset_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServiceAssetImage" ADD CONSTRAINT "ServiceAssetImage_serviceAssetId_fkey" FOREIGN KEY ("serviceAssetId") REFERENCES "public"."ServiceAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairJob" ADD CONSTRAINT "RepairJob_serviceAssetId_fkey" FOREIGN KEY ("serviceAssetId") REFERENCES "public"."ServiceAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_serviceAssetId_fkey" FOREIGN KEY ("serviceAssetId") REFERENCES "public"."ServiceAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxDocument" ADD CONSTRAINT "TaxDocument_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxDocument" ADD CONSTRAINT "TaxDocument_replacementOfId_fkey" FOREIGN KEY ("replacementOfId") REFERENCES "public"."TaxDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxDocument" ADD CONSTRAINT "TaxDocument_cancelledDocumentId_fkey" FOREIGN KEY ("cancelledDocumentId") REFERENCES "public"."TaxDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxDocumentSource" ADD CONSTRAINT "TaxDocumentSource_taxDocumentId_fkey" FOREIGN KEY ("taxDocumentId") REFERENCES "public"."TaxDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxDocumentEvent" ADD CONSTRAINT "TaxDocumentEvent_taxDocumentId_fkey" FOREIGN KEY ("taxDocumentId") REFERENCES "public"."TaxDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxSnapshot" ADD CONSTRAINT "TaxSnapshot_taxDocumentId_fkey" FOREIGN KEY ("taxDocumentId") REFERENCES "public"."TaxDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxSnapshotItem" ADD CONSTRAINT "TaxSnapshotItem_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "public"."TaxSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxLedgerEntry" ADD CONSTRAINT "TaxLedgerEntry_taxDocumentId_fkey" FOREIGN KEY ("taxDocumentId") REFERENCES "public"."TaxDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxLedgerEntry" ADD CONSTRAINT "TaxLedgerEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxLedgerEntry" ADD CONSTRAINT "TaxLedgerEntry_taxPeriodId_fkey" FOREIGN KEY ("taxPeriodId") REFERENCES "public"."TaxPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxPeriod" ADD CONSTRAINT "TaxPeriod_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
