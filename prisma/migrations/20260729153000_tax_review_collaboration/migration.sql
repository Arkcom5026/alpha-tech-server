-- P1 Tax Review Collaboration

CREATE TYPE "TaxReviewSessionStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED');

CREATE TABLE "TaxReviewSession" (
  "id" SERIAL NOT NULL,
  "assignmentId" INTEGER NOT NULL,
  "businessId" INTEGER NOT NULL,
  "branchId" INTEGER NOT NULL,
  "taxPeriodCode" VARCHAR(7) NOT NULL,
  "title" TEXT NOT NULL,
  "status" "TaxReviewSessionStatus" NOT NULL DEFAULT 'OPEN',
  "openedByUserId" INTEGER NOT NULL,
  "resolvedByUserId" INTEGER,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaxReviewSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxReviewNote" (
  "id" SERIAL NOT NULL,
  "reviewSessionId" INTEGER NOT NULL,
  "authorUserId" INTEGER NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxReviewNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaxReviewSession_assignmentId_status_idx" ON "TaxReviewSession"("assignmentId", "status");
CREATE INDEX "TaxReviewSession_businessId_branchId_taxPeriodCode_idx" ON "TaxReviewSession"("businessId", "branchId", "taxPeriodCode");
CREATE INDEX "TaxReviewNote_reviewSessionId_createdAt_idx" ON "TaxReviewNote"("reviewSessionId", "createdAt");

ALTER TABLE "TaxReviewSession"
  ADD CONSTRAINT "TaxReviewSession_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "BusinessAccountingFirmAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxReviewSession"
  ADD CONSTRAINT "TaxReviewSession_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxReviewSession"
  ADD CONSTRAINT "TaxReviewSession_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxReviewSession"
  ADD CONSTRAINT "TaxReviewSession_openedByUserId_fkey"
  FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxReviewSession"
  ADD CONSTRAINT "TaxReviewSession_resolvedByUserId_fkey"
  FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxReviewNote"
  ADD CONSTRAINT "TaxReviewNote_reviewSessionId_fkey"
  FOREIGN KEY ("reviewSessionId") REFERENCES "TaxReviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxReviewNote"
  ADD CONSTRAINT "TaxReviewNote_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
