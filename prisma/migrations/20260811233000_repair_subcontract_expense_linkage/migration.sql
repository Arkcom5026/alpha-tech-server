-- Increment 007: connect repair custody to ExpensePayee and accounting evidence.
-- Existing provider snapshots are preserved. The guard deliberately stops migration
-- when legacy subcontract rows cannot be mapped without a human decision.
ALTER TABLE "RepairSubcontract" ADD COLUMN "expensePayeeId" INTEGER;
ALTER TABLE "RepairSubcontract"
  ADD COLUMN "transportCost" DECIMAL(12,2),
  ADD COLUMN "materialCost" DECIMAL(12,2),
  ADD COLUMN "otherOperationalCost" DECIMAL(12,2),
  ADD CONSTRAINT "RepairSubcontract_operational_costs_check" CHECK (
    ("transportCost" IS NULL OR "transportCost" >= 0) AND
    ("materialCost" IS NULL OR "materialCost" >= 0) AND
    ("otherOperationalCost" IS NULL OR "otherOperationalCost" >= 0)
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "RepairSubcontract" WHERE "expensePayeeId" IS NULL) THEN
    RAISE EXCEPTION 'RepairSubcontract legacy rows require ExpensePayee mapping before Increment 007 can be applied';
  END IF;
END $$;

ALTER TABLE "RepairSubcontract" ALTER COLUMN "expensePayeeId" SET NOT NULL;
ALTER TABLE "RepairSubcontract"
  ADD CONSTRAINT "RepairSubcontract_expensePayeeId_branchId_fkey"
  FOREIGN KEY ("expensePayeeId", "branchId") REFERENCES "ExpensePayee"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "RepairSubcontract_branchId_expensePayeeId_idx"
  ON "RepairSubcontract"("branchId", "expensePayeeId");

ALTER TABLE "TaxExpense"
  ADD COLUMN "repairJobId" INTEGER,
  ADD COLUMN "repairSubcontractId" INTEGER;

ALTER TABLE "TaxExpense"
  ADD CONSTRAINT "TaxExpense_repairJobId_fkey"
  FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TaxExpense_repairSubcontractId_fkey"
  FOREIGN KEY ("repairSubcontractId") REFERENCES "RepairSubcontract"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TaxExpense_repair_reason_pair_check"
  CHECK (("repairJobId" IS NULL) = ("repairSubcontractId" IS NULL));

CREATE INDEX "TaxExpense_branchId_repairJobId_idx" ON "TaxExpense"("branchId", "repairJobId");
CREATE INDEX "TaxExpense_branchId_repairSubcontractId_idx" ON "TaxExpense"("branchId", "repairSubcontractId");
