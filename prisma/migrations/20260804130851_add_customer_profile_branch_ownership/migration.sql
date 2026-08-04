-- Add nullable store ownership foundation to CustomerProfile

ALTER TABLE "CustomerProfile"
ADD COLUMN "branchId" INTEGER;

CREATE INDEX "CustomerProfile_branchId_idx"
ON "CustomerProfile"("branchId");

ALTER TABLE "CustomerProfile"
ADD CONSTRAINT "CustomerProfile_branchId_fkey"
FOREIGN KEY ("branchId")
REFERENCES "Branch"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
