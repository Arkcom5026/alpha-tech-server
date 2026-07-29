-- Additive Store Customer backfill planning and audit foundation.
-- This migration creates no StoreCustomer records and never changes CustomerProfile.

CREATE TYPE "StoreCustomerBackfillRunStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "StoreCustomerBackfillCandidateStatus" AS ENUM (
  'PENDING',
  'ELIGIBLE',
  'AMBIGUOUS',
  'SKIPPED',
  'REJECTED',
  'APPROVED'
);
CREATE TYPE "StoreCustomerBackfillDecisionAction" AS ENUM (
  'REVIEW_QUEUED',
  'APPROVE',
  'REJECT',
  'SKIP',
  'MARK_AMBIGUOUS',
  'RETRY'
);

CREATE TABLE "StoreCustomerBackfillRun" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "status" "StoreCustomerBackfillRunStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceSnapshotMarker" TEXT NOT NULL,
  "dryRun" BOOLEAN NOT NULL DEFAULT true,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "scannedCount" INTEGER NOT NULL DEFAULT 0,
  "eligibleCount" INTEGER NOT NULL DEFAULT 0,
  "ambiguousCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "summaryMetadata" JSONB,
  "errorMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreCustomerBackfillRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreCustomerBackfillRun_code_key" ON "StoreCustomerBackfillRun"("code");
CREATE INDEX "StoreCustomerBackfillRun_status_createdAt_idx" ON "StoreCustomerBackfillRun"("status", "createdAt");

CREATE TABLE "StoreCustomerBackfillCandidate" (
  "id" SERIAL NOT NULL,
  "backfillRunId" INTEGER NOT NULL,
  "legacyCustomerProfileId" INTEGER NOT NULL,
  "branchId" INTEGER NOT NULL,
  "proposedStoreCustomerId" INTEGER,
  "status" "StoreCustomerBackfillCandidateStatus" NOT NULL DEFAULT 'PENDING',
  "evidenceMetadata" JSONB,
  "reasonCode" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreCustomerBackfillCandidate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreCustomerBackfillCandidate_backfillRunId_fkey"
    FOREIGN KEY ("backfillRunId") REFERENCES "StoreCustomerBackfillRun"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StoreCustomerBackfillCandidate_legacyCustomerProfileId_fkey"
    FOREIGN KEY ("legacyCustomerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StoreCustomerBackfillCandidate_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StoreCustomerBackfillCandidate_proposedStoreCustomerId_fkey"
    FOREIGN KEY ("proposedStoreCustomerId") REFERENCES "StoreCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StoreCustomerBackfillCandidate_run_legacy_branch_key"
  ON "StoreCustomerBackfillCandidate"("backfillRunId", "legacyCustomerProfileId", "branchId");
CREATE INDEX "StoreCustomerBackfillCandidate_legacy_branch_idx"
  ON "StoreCustomerBackfillCandidate"("legacyCustomerProfileId", "branchId");
CREATE INDEX "StoreCustomerBackfillCandidate_branch_status_idx"
  ON "StoreCustomerBackfillCandidate"("branchId", "status");
CREATE INDEX "StoreCustomerBackfillCandidate_proposedStoreCustomerId_idx"
  ON "StoreCustomerBackfillCandidate"("proposedStoreCustomerId");

CREATE TABLE "StoreCustomerBackfillDecision" (
  "id" SERIAL NOT NULL,
  "candidateId" INTEGER NOT NULL,
  "action" "StoreCustomerBackfillDecisionAction" NOT NULL,
  "previousStatus" "StoreCustomerBackfillCandidateStatus",
  "resultingStatus" "StoreCustomerBackfillCandidateStatus" NOT NULL,
  "reasonCode" TEXT,
  "note" TEXT,
  "actorUserId" INTEGER,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreCustomerBackfillDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreCustomerBackfillDecision_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "StoreCustomerBackfillCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StoreCustomerBackfillDecision_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "StoreCustomerBackfillDecision_candidate_decidedAt_idx"
  ON "StoreCustomerBackfillDecision"("candidateId", "decidedAt");
CREATE INDEX "StoreCustomerBackfillDecision_actorUser_decidedAt_idx"
  ON "StoreCustomerBackfillDecision"("actorUserId", "decidedAt");
