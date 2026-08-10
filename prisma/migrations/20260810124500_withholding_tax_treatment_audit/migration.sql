-- Additive audit authority for human-confirmed WHT treatment transitions.
-- No backfill and no mutation of existing TaxExpenseItem rows.

CREATE TABLE "WithholdingTaxTreatmentEvent" (
  "id" TEXT NOT NULL,
  "branchId" INTEGER NOT NULL,
  "taxExpenseId" INTEGER NOT NULL,
  "taxExpenseItemId" INTEGER NOT NULL,
  "previousTreatment" "TaxExpenseWhtTreatment" NOT NULL,
  "resultingTreatment" "TaxExpenseWhtTreatment" NOT NULL,
  "actorEmployeeId" INTEGER NOT NULL,
  "note" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WithholdingTaxTreatmentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WithholdingTaxTreatmentEvent_branchId_taxExpenseId_occurredAt_idx"
  ON "WithholdingTaxTreatmentEvent"("branchId", "taxExpenseId", "occurredAt");
CREATE INDEX "WithholdingTaxTreatmentEvent_taxExpenseItemId_occurredAt_idx"
  ON "WithholdingTaxTreatmentEvent"("taxExpenseItemId", "occurredAt");
CREATE INDEX "WithholdingTaxTreatmentEvent_actorEmployeeId_idx"
  ON "WithholdingTaxTreatmentEvent"("actorEmployeeId");

ALTER TABLE "WithholdingTaxTreatmentEvent"
  ADD CONSTRAINT "WithholdingTaxTreatmentEvent_taxExpenseId_branchId_fkey"
  FOREIGN KEY ("taxExpenseId", "branchId") REFERENCES "TaxExpense"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WithholdingTaxTreatmentEvent"
  ADD CONSTRAINT "WithholdingTaxTreatmentEvent_taxExpenseItemId_branchId_fkey"
  FOREIGN KEY ("taxExpenseItemId", "branchId") REFERENCES "TaxExpenseItem"("id", "branchId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WithholdingTaxTreatmentEvent"
  ADD CONSTRAINT "WithholdingTaxTreatmentEvent_actorEmployeeId_fkey"
  FOREIGN KEY ("actorEmployeeId") REFERENCES "EmployeeProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
