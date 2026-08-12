-- Additive-only customer department and shared financial authority foundation.
ALTER TABLE "CustomerProfile"
  ADD COLUMN "departmentName" TEXT,
  ADD COLUMN "financialOwnerCustomerId" INTEGER;

CREATE INDEX "CustomerProfile_financialOwnerCustomerId_idx"
  ON "CustomerProfile"("financialOwnerCustomerId");
CREATE INDEX "CustomerProfile_branchId_financialOwnerCustomerId_idx"
  ON "CustomerProfile"("branchId", "financialOwnerCustomerId");

ALTER TABLE "CustomerProfile"
  ADD CONSTRAINT "CustomerProfile_financialOwnerCustomerId_fkey"
  FOREIGN KEY ("financialOwnerCustomerId") REFERENCES "CustomerProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
