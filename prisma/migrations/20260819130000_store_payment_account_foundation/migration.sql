CREATE TABLE "StorePaymentAccount" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "bankName" VARCHAR(160) NOT NULL,
    "accountName" VARCHAR(200) NOT NULL,
    "accountNumber" VARCHAR(80) NOT NULL,
    "accountType" VARCHAR(80),
    "promptPayId" VARCHAR(80),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePaymentAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorePaymentAccount_branchId_code_key"
ON "StorePaymentAccount"("branchId", "code");

CREATE UNIQUE INDEX "StorePaymentAccount_branchId_id_key"
ON "StorePaymentAccount"("branchId", "id");

CREATE INDEX "StorePaymentAccount_branchId_isActive_sortOrder_idx"
ON "StorePaymentAccount"("branchId", "isActive", "sortOrder");

CREATE INDEX "StorePaymentAccount_branchId_accountNumber_idx"
ON "StorePaymentAccount"("branchId", "accountNumber");

ALTER TABLE "StorePaymentAccount"
ADD CONSTRAINT "StorePaymentAccount_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
