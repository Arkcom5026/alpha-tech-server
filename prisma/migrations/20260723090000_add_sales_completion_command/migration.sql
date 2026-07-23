CREATE TABLE "SalesCompletionCommand" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "commandKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "saleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesCompletionCommand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesCompletionCommand_saleId_key" ON "SalesCompletionCommand"("saleId");
CREATE UNIQUE INDEX "SalesCompletionCommand_branchId_commandKey_key" ON "SalesCompletionCommand"("branchId", "commandKey");
CREATE INDEX "SalesCompletionCommand_branchId_createdAt_idx" ON "SalesCompletionCommand"("branchId", "createdAt");

ALTER TABLE "SalesCompletionCommand" ADD CONSTRAINT "SalesCompletionCommand_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesCompletionCommand" ADD CONSTRAINT "SalesCompletionCommand_saleId_fkey"
FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
