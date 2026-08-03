-- CreateEnum
CREATE TYPE "public"."ProductTemplateCandidateStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'REJECTED', 'PROMOTED', 'MERGED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ProductTemplateCandidateEventType" AS ENUM ('CREATED', 'REVIEW_STARTED', 'PROPOSED_DATA_UPDATED', 'REJECTED', 'PROMOTED', 'MERGED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."ProductTemplateCandidate" (
    "id" SERIAL NOT NULL,
    "sourceBranchId" INTEGER NOT NULL,
    "sourceProductId" INTEGER NOT NULL,
    "targetTemplateBranchId" INTEGER NOT NULL,
    "targetTemplateProductId" INTEGER,
    "status" "public"."ProductTemplateCandidateStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceSnapshot" JSONB NOT NULL,
    "proposedTemplateData" JSONB,
    "duplicateAssessment" JSONB,
    "createdByEmployeeId" INTEGER,
    "reviewedByEmployeeId" INTEGER,
    "decisionNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTemplateCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductTemplateCandidateEvent" (
    "id" SERIAL NOT NULL,
    "candidateId" INTEGER NOT NULL,
    "eventType" "public"."ProductTemplateCandidateEventType" NOT NULL,
    "previousStatus" "public"."ProductTemplateCandidateStatus",
    "resultingStatus" "public"."ProductTemplateCandidateStatus" NOT NULL,
    "actorEmployeeId" INTEGER,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductTemplateCandidateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductTemplateCandidate_sourceBranchId_sourceProductId_idx" ON "public"."ProductTemplateCandidate"("sourceBranchId", "sourceProductId");
CREATE INDEX "ProductTemplateCandidate_targetTemplateBranchId_status_idx" ON "public"."ProductTemplateCandidate"("targetTemplateBranchId", "status");
CREATE INDEX "ProductTemplateCandidate_status_createdAt_idx" ON "public"."ProductTemplateCandidate"("status", "createdAt");
CREATE INDEX "ProductTemplateCandidate_targetTemplateProductId_idx" ON "public"."ProductTemplateCandidate"("targetTemplateProductId");
CREATE INDEX "ProductTemplateCandidateEvent_candidateId_createdAt_idx" ON "public"."ProductTemplateCandidateEvent"("candidateId", "createdAt");
CREATE INDEX "ProductTemplateCandidateEvent_eventType_createdAt_idx" ON "public"."ProductTemplateCandidateEvent"("eventType", "createdAt");
CREATE INDEX "ProductTemplateCandidateEvent_actorEmployeeId_idx" ON "public"."ProductTemplateCandidateEvent"("actorEmployeeId");

-- AddForeignKey
ALTER TABLE "public"."ProductTemplateCandidate" ADD CONSTRAINT "ProductTemplateCandidate_sourceBranchId_fkey" FOREIGN KEY ("sourceBranchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ProductTemplateCandidate" ADD CONSTRAINT "ProductTemplateCandidate_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ProductTemplateCandidate" ADD CONSTRAINT "ProductTemplateCandidate_targetTemplateBranchId_fkey" FOREIGN KEY ("targetTemplateBranchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ProductTemplateCandidate" ADD CONSTRAINT "ProductTemplateCandidate_targetTemplateProductId_fkey" FOREIGN KEY ("targetTemplateProductId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ProductTemplateCandidate" ADD CONSTRAINT "ProductTemplateCandidate_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ProductTemplateCandidate" ADD CONSTRAINT "ProductTemplateCandidate_reviewedByEmployeeId_fkey" FOREIGN KEY ("reviewedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ProductTemplateCandidateEvent" ADD CONSTRAINT "ProductTemplateCandidateEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "public"."ProductTemplateCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ProductTemplateCandidateEvent" ADD CONSTRAINT "ProductTemplateCandidateEvent_actorEmployeeId_fkey" FOREIGN KEY ("actorEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
