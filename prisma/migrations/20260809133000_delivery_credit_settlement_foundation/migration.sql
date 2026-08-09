-- CreateTable
CREATE TABLE "public"."CustomerMoneySettlement" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "branchId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "settlementType" VARCHAR(30) NOT NULL DEFAULT 'DELIVERY_CREDIT',
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdById" INTEGER NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" INTEGER,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerMoneySettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerMoneySettlementLine" (
    "id" SERIAL NOT NULL,
    "settlementId" INTEGER NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "saleId" INTEGER NOT NULL,
    "saleCode" VARCHAR(100) NOT NULL,
    "saleItemType" VARCHAR(20) NOT NULL,
    "saleItemId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitAmount" DECIMAL(12,2) NOT NULL,
    "lineAmount" DECIMAL(12,2) NOT NULL,
    "appliedAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerMoneySettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMoneySettlement_code_key" ON "public"."CustomerMoneySettlement"("code");

-- CreateIndex
CREATE INDEX "CustomerMoneySettlement_branchId_idx" ON "public"."CustomerMoneySettlement"("branchId");

-- CreateIndex
CREATE INDEX "CustomerMoneySettlement_customerId_idx" ON "public"."CustomerMoneySettlement"("customerId");

-- CreateIndex
CREATE INDEX "CustomerMoneySettlement_branchId_status_settledAt_idx" ON "public"."CustomerMoneySettlement"("branchId", "status", "settledAt");

-- CreateIndex
CREATE INDEX "CustomerMoneySettlementLine_settlementId_idx" ON "public"."CustomerMoneySettlementLine"("settlementId");

-- CreateIndex
CREATE INDEX "CustomerMoneySettlementLine_applicationId_idx" ON "public"."CustomerMoneySettlementLine"("applicationId");

-- CreateIndex
CREATE INDEX "CustomerMoneySettlementLine_saleId_idx" ON "public"."CustomerMoneySettlementLine"("saleId");

-- CreateIndex
CREATE INDEX "CustomerMoneySettlementLine_saleItemType_saleItemId_idx" ON "public"."CustomerMoneySettlementLine"("saleItemType", "saleItemId");

-- AddForeignKey
ALTER TABLE "public"."CustomerMoneySettlement" ADD CONSTRAINT "CustomerMoneySettlement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerMoneySettlementLine" ADD CONSTRAINT "CustomerMoneySettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "public"."CustomerMoneySettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerMoneySettlementLine" ADD CONSTRAINT "CustomerMoneySettlementLine_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "public"."CustomerMoneyApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
