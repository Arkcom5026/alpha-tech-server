-- CreateTable
CREATE TABLE "public"."CustomerMoneyApplication" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "sourceType" VARCHAR(50) NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "targetType" VARCHAR(50) NOT NULL,
    "targetId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'APPLIED',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerMoneyApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerMoneyLedger" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "applicationId" INTEGER,
    "eventType" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "direction" VARCHAR(20) NOT NULL,
    "referenceType" VARCHAR(50),
    "referenceId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerMoneyLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerMoneyBalance" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "availableAmount" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerMoneyBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerMoneyApplication_customerId_idx" ON "public"."CustomerMoneyApplication"("customerId");

-- CreateIndex
CREATE INDEX "CustomerMoneyApplication_sourceType_sourceId_idx" ON "public"."CustomerMoneyApplication"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "CustomerMoneyApplication_targetType_targetId_idx" ON "public"."CustomerMoneyApplication"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "CustomerMoneyApplication_branchId_idx" ON "public"."CustomerMoneyApplication"("branchId");

-- CreateIndex
CREATE INDEX "CustomerMoneyLedger_customerId_idx" ON "public"."CustomerMoneyLedger"("customerId");

-- CreateIndex
CREATE INDEX "CustomerMoneyLedger_applicationId_idx" ON "public"."CustomerMoneyLedger"("applicationId");

-- CreateIndex
CREATE INDEX "CustomerMoneyLedger_referenceType_referenceId_idx" ON "public"."CustomerMoneyLedger"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "CustomerMoneyLedger_branchId_idx" ON "public"."CustomerMoneyLedger"("branchId");

-- CreateIndex
CREATE INDEX "CustomerMoneyBalance_customerId_idx" ON "public"."CustomerMoneyBalance"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerMoneyBalance_branchId_customerId_key" ON "public"."CustomerMoneyBalance"("branchId", "customerId");

-- AddForeignKey
ALTER TABLE "public"."CustomerMoneyApplication" ADD CONSTRAINT "CustomerMoneyApplication_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerMoneyLedger" ADD CONSTRAINT "CustomerMoneyLedger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerMoneyLedger" ADD CONSTRAINT "CustomerMoneyLedger_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "public"."CustomerMoneyApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerMoneyBalance" ADD CONSTRAINT "CustomerMoneyBalance_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
