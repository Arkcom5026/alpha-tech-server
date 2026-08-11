-- CreateTable
CREATE TABLE "public"."CustomerMoneySettlementCommand" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "commandKey" VARCHAR(100) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "settlementId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerMoneySettlementCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMoneySettlementCommand_settlementId_key" ON "public"."CustomerMoneySettlementCommand"("settlementId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMoneySettlementCommand_branchId_commandKey_key" ON "public"."CustomerMoneySettlementCommand"("branchId", "commandKey");

-- CreateIndex
CREATE INDEX "CustomerMoneySettlementCommand_customerId_createdAt_idx" ON "public"."CustomerMoneySettlementCommand"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."CustomerMoneySettlementCommand" ADD CONSTRAINT "CustomerMoneySettlementCommand_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "public"."CustomerMoneySettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
