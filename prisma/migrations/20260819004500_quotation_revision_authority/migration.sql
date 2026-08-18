-- Quotation Revision Authority
ALTER TYPE "QuotationEventType" ADD VALUE IF NOT EXISTS 'REVISION_CREATED';

ALTER TABLE "Quotation"
  ADD COLUMN "revisionNumber" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "revisionRootId" INTEGER,
  ADD COLUMN "revisedFromId" INTEGER;

DROP INDEX IF EXISTS "Quotation_code_key";

CREATE UNIQUE INDEX "Quotation_branchId_code_revisionNumber_key"
  ON "Quotation"("branchId", "code", "revisionNumber");

CREATE UNIQUE INDEX "Quotation_revisedFromId_key"
  ON "Quotation"("revisedFromId");

CREATE INDEX "Quotation_revisionRootId_revisionNumber_idx"
  ON "Quotation"("revisionRootId", "revisionNumber");

ALTER TABLE "Quotation"
  ADD CONSTRAINT "Quotation_revisionRootId_fkey"
  FOREIGN KEY ("revisionRootId") REFERENCES "Quotation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Quotation"
  ADD CONSTRAINT "Quotation_revisedFromId_fkey"
  FOREIGN KEY ("revisedFromId") REFERENCES "Quotation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
