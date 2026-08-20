CREATE TABLE "SaleDocumentPreparation" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'SALE',
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceTotal" DECIMAL(14,2) NOT NULL,
    "documentTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "agencyContext" JSONB,
    "finalSnapshot" JSONB,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "lockedById" INTEGER,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleDocumentPreparation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleDocumentPreparationLine" (
    "id" SERIAL NOT NULL,
    "preparationId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitName" TEXT,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleDocumentPreparationLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SaleDocumentPreparation_branch_source_key"
ON "SaleDocumentPreparation"("branchId", "sourceType", "sourceId");

CREATE INDEX "SaleDocumentPreparation_branchId_status_updatedAt_idx"
ON "SaleDocumentPreparation"("branchId", "status", "updatedAt");

CREATE INDEX "SaleDocumentPreparation_branchId_sourceType_sourceId_idx"
ON "SaleDocumentPreparation"("branchId", "sourceType", "sourceId");

CREATE INDEX "SaleDocumentPreparationLine_preparationId_sortOrder_idx"
ON "SaleDocumentPreparationLine"("preparationId", "sortOrder");

ALTER TABLE "SaleDocumentPreparationLine"
ADD CONSTRAINT "SaleDocumentPreparationLine_preparationId_fkey"
FOREIGN KEY ("preparationId") REFERENCES "SaleDocumentPreparation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
