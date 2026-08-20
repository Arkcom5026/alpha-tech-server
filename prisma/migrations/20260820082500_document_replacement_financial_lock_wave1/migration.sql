CREATE TABLE "SaleDocumentReplacement" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "preparationId" INTEGER NOT NULL,
    "replacementNumber" INTEGER NOT NULL,
    "replacesReplacementId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "draftKey" TEXT,
    "currentKey" TEXT,
    "reason" TEXT NOT NULL,
    "financialLock" JSONB NOT NULL,
    "finalSnapshot" JSONB,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "lockedById" INTEGER,
    "lockedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleDocumentReplacement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleDocumentReplacementLine" (
    "id" SERIAL NOT NULL,
    "replacementId" INTEGER NOT NULL,
    "portion" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitName" TEXT,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "lineType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleDocumentReplacementLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SaleDocumentReplacement_draftKey_key"
ON "SaleDocumentReplacement"("draftKey");

CREATE UNIQUE INDEX "SaleDocumentReplacement_currentKey_key"
ON "SaleDocumentReplacement"("currentKey");

CREATE UNIQUE INDEX "SaleDocumentReplacement_preparation_number_key"
ON "SaleDocumentReplacement"("preparationId", "replacementNumber");

CREATE INDEX "SaleDocumentReplacement_branchId_preparationId_status_idx"
ON "SaleDocumentReplacement"("branchId", "preparationId", "status");

CREATE INDEX "SaleDocumentReplacement_preparationId_currentKey_idx"
ON "SaleDocumentReplacement"("preparationId", "currentKey");

CREATE INDEX "SaleDocumentReplacement_replacesReplacementId_idx"
ON "SaleDocumentReplacement"("replacesReplacementId");

CREATE INDEX "SaleDocumentReplacementLine_replacementId_portion_sortOrder_idx"
ON "SaleDocumentReplacementLine"("replacementId", "portion", "sortOrder");

ALTER TABLE "SaleDocumentReplacement"
ADD CONSTRAINT "SaleDocumentReplacement_preparationId_fkey"
FOREIGN KEY ("preparationId") REFERENCES "SaleDocumentPreparation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleDocumentReplacement"
ADD CONSTRAINT "SaleDocumentReplacement_replacesReplacementId_fkey"
FOREIGN KEY ("replacesReplacementId") REFERENCES "SaleDocumentReplacement"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleDocumentReplacementLine"
ADD CONSTRAINT "SaleDocumentReplacementLine_replacementId_fkey"
FOREIGN KEY ("replacementId") REFERENCES "SaleDocumentReplacement"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
