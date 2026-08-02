-- Tax Expense tenant boundary: no cross-store supplier or category links.
-- The new TaxExpense tables must remain empty until this invariant is installed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "TaxExpense") OR EXISTS (SELECT 1 FROM "TaxExpenseItem") THEN
    RAISE EXCEPTION 'Tax Expense tenant isolation migration requires empty TaxExpense and TaxExpenseItem tables; no automatic backfill is permitted.';
  END IF;
END $$;

ALTER TABLE "TaxExpenseItem" ADD COLUMN "branchId" INTEGER NOT NULL;

CREATE UNIQUE INDEX "Supplier_id_branchId_key" ON "Supplier"("id", "branchId");
CREATE UNIQUE INDEX "TaxExpenseCategory_id_branchId_key" ON "TaxExpenseCategory"("id", "branchId");
CREATE UNIQUE INDEX "TaxExpense_id_branchId_key" ON "TaxExpense"("id", "branchId");

CREATE INDEX "TaxExpenseItem_branchId_idx" ON "TaxExpenseItem"("branchId");

ALTER TABLE "TaxExpense"
  ADD CONSTRAINT "TaxExpense_supplierId_branchId_fkey"
  FOREIGN KEY ("supplierId", "branchId") REFERENCES "Supplier"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaxExpenseItem"
  ADD CONSTRAINT "TaxExpenseItem_taxExpenseId_branchId_fkey"
  FOREIGN KEY ("taxExpenseId", "branchId") REFERENCES "TaxExpense"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaxExpenseItem"
  ADD CONSTRAINT "TaxExpenseItem_categoryId_branchId_fkey"
  FOREIGN KEY ("categoryId", "branchId") REFERENCES "TaxExpenseCategory"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
