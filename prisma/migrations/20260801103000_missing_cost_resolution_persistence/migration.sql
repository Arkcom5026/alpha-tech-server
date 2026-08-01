CREATE TYPE "MissingCostResolutionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RETURNED_FOR_CORRECTION', 'CANCELLED', 'SUPERSEDED');

CREATE TYPE "MissingCostEvidenceSourceType" AS ENUM ('LEGACY_INVOICE', 'SUPPLIER_DOCUMENT', 'PURCHASE_RECORD', 'HISTORICAL_COST_REFERENCE', 'MANUAL_BUSINESS_DECISION');

CREATE TYPE "MissingCostEvidenceConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

CREATE TYPE "MissingCostResolutionEventType" AS ENUM ('CREATED', 'EVIDENCE_VERSION_CREATED', 'UPDATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RETURNED_FOR_CORRECTION', 'CANCELLED', 'SUPERSEDED', 'RECOVERY_PREVIEW_REQUESTED');

CREATE TABLE "MissingCostResolution" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "stockBalanceId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "sourceAuditId" TEXT NOT NULL,
    "sourceSnapshotHash" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "candidateIdentityHash" TEXT NOT NULL,
    "candidateEntryId" TEXT NOT NULL,
    "status" "MissingCostResolutionStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdByEmployeeId" INTEGER NOT NULL,
    "approvedByEmployeeId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MissingCostResolution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MissingCostResolutionVersion" (
    "id" SERIAL NOT NULL,
    "resolutionId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "sourceType" "MissingCostEvidenceSourceType" NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "evidenceSummary" TEXT NOT NULL,
    "proposedUnitCost" DECIMAL(12,2) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "confidence" "MissingCostEvidenceConfidence" NOT NULL,
    "rationale" TEXT NOT NULL,
    "proposerEmployeeId" INTEGER NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "candidateSnapshotHash" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByEmployeeId" INTEGER,
    "approvalSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissingCostResolutionVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MissingCostResolutionEvent" (
    "id" SERIAL NOT NULL,
    "resolutionId" INTEGER NOT NULL,
    "versionId" INTEGER,
    "eventType" "MissingCostResolutionEventType" NOT NULL,
    "previousStatus" "MissingCostResolutionStatus",
    "resultingStatus" "MissingCostResolutionStatus",
    "actorEmployeeId" INTEGER NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "note" TEXT,
    "evidenceHash" TEXT,
    "candidateSnapshotHash" TEXT,
    "eventHash" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissingCostResolutionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MissingCostResolution_branchId_candidateIdentityHash_key" ON "MissingCostResolution"("branchId", "candidateIdentityHash");
CREATE UNIQUE INDEX "MissingCostResolution_branchId_candidateId_key" ON "MissingCostResolution"("branchId", "candidateId");
CREATE INDEX "MissingCostResolution_branchId_status_idx" ON "MissingCostResolution"("branchId", "status");
CREATE INDEX "MissingCostResolution_branchId_productId_idx" ON "MissingCostResolution"("branchId", "productId");
CREATE INDEX "MissingCostResolution_branchId_stockBalanceId_idx" ON "MissingCostResolution"("branchId", "stockBalanceId");
CREATE INDEX "MissingCostResolution_branchId_createdAt_idx" ON "MissingCostResolution"("branchId", "createdAt");
CREATE INDEX "MissingCostResolution_sourceSnapshotHash_idx" ON "MissingCostResolution"("sourceSnapshotHash");

CREATE UNIQUE INDEX "MissingCostResolutionVersion_resolutionId_version_key" ON "MissingCostResolutionVersion"("resolutionId", "version");
CREATE UNIQUE INDEX "MissingCostResolutionVersion_resolutionId_evidenceHash_key" ON "MissingCostResolutionVersion"("resolutionId", "evidenceHash");
CREATE INDEX "MissingCostResolutionVersion_resolutionId_createdAt_idx" ON "MissingCostResolutionVersion"("resolutionId", "createdAt");
CREATE INDEX "MissingCostResolutionVersion_proposerEmployeeId_idx" ON "MissingCostResolutionVersion"("proposerEmployeeId");
CREATE INDEX "MissingCostResolutionVersion_approvedByEmployeeId_idx" ON "MissingCostResolutionVersion"("approvedByEmployeeId");
CREATE INDEX "MissingCostResolutionVersion_evidenceHash_idx" ON "MissingCostResolutionVersion"("evidenceHash");

CREATE UNIQUE INDEX "MissingCostResolutionEvent_resolutionId_eventHash_key" ON "MissingCostResolutionEvent"("resolutionId", "eventHash");
CREATE INDEX "MissingCostResolutionEvent_resolutionId_occurredAt_idx" ON "MissingCostResolutionEvent"("resolutionId", "occurredAt");
CREATE INDEX "MissingCostResolutionEvent_versionId_idx" ON "MissingCostResolutionEvent"("versionId");
CREATE INDEX "MissingCostResolutionEvent_actorEmployeeId_idx" ON "MissingCostResolutionEvent"("actorEmployeeId");
CREATE INDEX "MissingCostResolutionEvent_eventType_occurredAt_idx" ON "MissingCostResolutionEvent"("eventType", "occurredAt");

ALTER TABLE "MissingCostResolution" ADD CONSTRAINT "MissingCostResolution_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissingCostResolution" ADD CONSTRAINT "MissingCostResolution_stockBalanceId_fkey" FOREIGN KEY ("stockBalanceId") REFERENCES "StockBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissingCostResolution" ADD CONSTRAINT "MissingCostResolution_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissingCostResolution" ADD CONSTRAINT "MissingCostResolution_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissingCostResolution" ADD CONSTRAINT "MissingCostResolution_approvedByEmployeeId_fkey" FOREIGN KEY ("approvedByEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissingCostResolutionVersion" ADD CONSTRAINT "MissingCostResolutionVersion_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "MissingCostResolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissingCostResolutionVersion" ADD CONSTRAINT "MissingCostResolutionVersion_proposerEmployeeId_fkey" FOREIGN KEY ("proposerEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissingCostResolutionVersion" ADD CONSTRAINT "MissingCostResolutionVersion_approvedByEmployeeId_fkey" FOREIGN KEY ("approvedByEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissingCostResolutionEvent" ADD CONSTRAINT "MissingCostResolutionEvent_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "MissingCostResolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissingCostResolutionEvent" ADD CONSTRAINT "MissingCostResolutionEvent_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "MissingCostResolutionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissingCostResolutionEvent" ADD CONSTRAINT "MissingCostResolutionEvent_actorEmployeeId_fkey" FOREIGN KEY ("actorEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
