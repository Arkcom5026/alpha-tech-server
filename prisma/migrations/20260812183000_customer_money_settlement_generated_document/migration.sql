CREATE TABLE "public"."CustomerMoneySettlementGeneratedDocument" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "settlementId" INTEGER NOT NULL,
    "combinedBillingId" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "CustomerMoneySettlementGeneratedDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerMoneySettlementGeneratedDocument_settlementId_key"
ON "public"."CustomerMoneySettlementGeneratedDocument"("settlementId");

CREATE UNIQUE INDEX "CustomerMoneySettlementGeneratedDocument_combinedBillingId_key"
ON "public"."CustomerMoneySettlementGeneratedDocument"("combinedBillingId");

CREATE INDEX "CustomerMoneySettlementGeneratedDocument_branchId_status_createdAt_idx"
ON "public"."CustomerMoneySettlementGeneratedDocument"("branchId", "status", "createdAt");
