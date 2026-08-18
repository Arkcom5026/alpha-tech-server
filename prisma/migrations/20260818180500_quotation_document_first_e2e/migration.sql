CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'ISSUED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'CONVERTED');
CREATE TYPE "QuotationLineSource" AS ENUM ('MANUAL', 'PRODUCT_ASSISTED');
CREATE TYPE "QuotationEventType" AS ENUM ('CREATED', 'UPDATED', 'LINE_ADDED', 'LINE_UPDATED', 'LINE_REMOVED', 'ISSUED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'CONVERTED');

CREATE TABLE "Quotation" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,
    "customerId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "issueDate" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "subject" TEXT,
    "introduction" TEXT,
    "closingNote" TEXT,
    "notes" TEXT,
    "paymentTerms" TEXT,
    "customerName" TEXT,
    "customerCompany" TEXT,
    "customerDepartment" TEXT,
    "customerContactName" TEXT,
    "customerPhone" TEXT,
    "customerTaxId" TEXT,
    "customerAddress" TEXT,
    "customerSnapshot" JSONB,
    "documentHeaderSnapshot" JSONB,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineDiscountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "billDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 7,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "convertedSaleId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuotationItem" (
    "id" SERIAL NOT NULL,
    "quotationId" INTEGER NOT NULL,
    "sourceType" "QuotationLineSource" NOT NULL DEFAULT 'MANUAL',
    "sourceProductId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unitName" TEXT,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuotationEvent" (
    "id" SERIAL NOT NULL,
    "quotationId" INTEGER NOT NULL,
    "eventType" "QuotationEventType" NOT NULL,
    "previousStatus" "QuotationStatus",
    "resultingStatus" "QuotationStatus" NOT NULL,
    "actorId" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuotationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Quotation_code_key" ON "Quotation"("code");
CREATE UNIQUE INDEX "Quotation_convertedSaleId_key" ON "Quotation"("convertedSaleId");
CREATE INDEX "Quotation_branchId_status_updatedAt_idx" ON "Quotation"("branchId", "status", "updatedAt");
CREATE INDEX "Quotation_branchId_customerId_updatedAt_idx" ON "Quotation"("branchId", "customerId", "updatedAt");
CREATE INDEX "Quotation_branchId_code_idx" ON "Quotation"("branchId", "code");
CREATE INDEX "QuotationItem_quotationId_sortOrder_idx" ON "QuotationItem"("quotationId", "sortOrder");
CREATE INDEX "QuotationItem_sourceProductId_idx" ON "QuotationItem"("sourceProductId");
CREATE INDEX "QuotationEvent_quotationId_createdAt_idx" ON "QuotationEvent"("quotationId", "createdAt");
CREATE INDEX "QuotationEvent_actorId_createdAt_idx" ON "QuotationEvent"("actorId", "createdAt");

ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuotationEvent" ADD CONSTRAINT "QuotationEvent_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;