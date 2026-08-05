-- CreateEnum
CREATE TYPE "public"."ExpensePayeeType" AS ENUM ('INDIVIDUAL', 'LEGAL_ENTITY', 'GOVERNMENT', 'OTHER');

-- AlterEnum
ALTER TYPE "public"."TaxExpenseCounterpartyType" ADD VALUE 'EXPENSE_PAYEE';

-- AlterTable
ALTER TABLE "public"."TaxExpense" ADD COLUMN     "expensePayeeId" INTEGER;

-- CreateTable
CREATE TABLE "public"."ExpensePayee" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "payeeType" "public"."ExpensePayeeType" NOT NULL DEFAULT 'LEGAL_ENTITY',
    "name" TEXT NOT NULL,
    "taxId" VARCHAR(13),
    "taxBranchCode" VARCHAR(5) DEFAULT '00000',
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "contactPerson" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByEmployeeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpensePayee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpensePayee_branchId_active_idx" ON "public"."ExpensePayee"("branchId", "active");

-- CreateIndex
CREATE INDEX "ExpensePayee_branchId_name_idx" ON "public"."ExpensePayee"("branchId", "name");

-- CreateIndex
CREATE INDEX "ExpensePayee_branchId_taxId_idx" ON "public"."ExpensePayee"("branchId", "taxId");

-- CreateIndex
CREATE INDEX "ExpensePayee_createdByEmployeeId_idx" ON "public"."ExpensePayee"("createdByEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpensePayee_id_branchId_key" ON "public"."ExpensePayee"("id", "branchId");

-- CreateIndex
CREATE INDEX "TaxExpense_branchId_expensePayeeId_idx" ON "public"."TaxExpense"("branchId", "expensePayeeId");

-- AddForeignKey
ALTER TABLE "public"."ExpensePayee" ADD CONSTRAINT "ExpensePayee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExpensePayee" ADD CONSTRAINT "ExpensePayee_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaxExpense" ADD CONSTRAINT "TaxExpense_expensePayeeId_branchId_fkey" FOREIGN KEY ("expensePayeeId", "branchId") REFERENCES "public"."ExpensePayee"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;
