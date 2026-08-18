CREATE TABLE "ConsolidatedDeliveryLinePresentation" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "combinedBillingId" INTEGER NOT NULL,
    "consolidatedDeliveryLineId" INTEGER NOT NULL,
    "documentPrefix" TEXT,
    "documentDescription" TEXT,
    "documentSuffix" TEXT,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsolidatedDeliveryLinePresentation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConsolidatedDeliveryLinePresentation_branchId_consolidatedDeliveryLineId_key"
ON "ConsolidatedDeliveryLinePresentation"("branchId", "consolidatedDeliveryLineId");

CREATE INDEX "ConsolidatedDeliveryLinePresentation_branchId_combinedBillingId_idx"
ON "ConsolidatedDeliveryLinePresentation"("branchId", "combinedBillingId");
