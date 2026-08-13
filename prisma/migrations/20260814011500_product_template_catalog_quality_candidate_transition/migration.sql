-- CreateEnum
CREATE TYPE "public"."ProductTemplateCandidateType" AS ENUM ('POSSIBLE_DUPLICATE', 'QUALITY_REVIEW', 'ORPHAN_UNUSED');

-- AlterEnum
ALTER TYPE "public"."ProductTemplateCandidateStatus" ADD VALUE IF NOT EXISTS 'OPEN';
ALTER TYPE "public"."ProductTemplateCandidateStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';
ALTER TYPE "public"."ProductTemplateCandidateStatus" ADD VALUE IF NOT EXISTS 'DISMISSED';
ALTER TYPE "public"."ProductTemplateCandidateStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "public"."ProductTemplateCandidateEventType" ADD VALUE IF NOT EXISTS 'DUPLICATE_RESOLVED';

-- Relax legacy Store Product -> Candidate fields for transition.
ALTER TABLE "public"."ProductTemplateCandidate"
  ALTER COLUMN "sourceBranchId" DROP NOT NULL,
  ALTER COLUMN "sourceProductId" DROP NOT NULL,
  ALTER COLUMN "targetTemplateBranchId" DROP NOT NULL;

-- Add catalog-quality authority fields.
ALTER TABLE "public"."ProductTemplateCandidate"
  ADD COLUMN "type" "public"."ProductTemplateCandidateType",
  ADD COLUMN "templateBranchId" INTEGER,
  ADD COLUMN "primaryTemplateProductId" INTEGER,
  ADD COLUMN "comparisonTemplateProductId" INTEGER,
  ADD COLUMN "dedupeKey" TEXT,
  ADD COLUMN "assessment" JSONB,
  ADD COLUMN "resolution" JSONB,
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ProductTemplateCandidate_dedupeKey_key" ON "public"."ProductTemplateCandidate"("dedupeKey");
CREATE INDEX "ProductTemplateCandidate_templateBranchId_type_status_idx" ON "public"."ProductTemplateCandidate"("templateBranchId", "type", "status");
CREATE INDEX "ProductTemplateCandidate_primaryTemplateProductId_idx" ON "public"."ProductTemplateCandidate"("primaryTemplateProductId");
CREATE INDEX "ProductTemplateCandidate_comparisonTemplateProductId_idx" ON "public"."ProductTemplateCandidate"("comparisonTemplateProductId");
CREATE INDEX "ProductTemplateCandidate_type_status_createdAt_idx" ON "public"."ProductTemplateCandidate"("type", "status", "createdAt");
