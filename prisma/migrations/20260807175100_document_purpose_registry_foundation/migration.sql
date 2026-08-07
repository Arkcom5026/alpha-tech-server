-- CreateTable
CREATE TABLE "public"."DocumentPurposeDefinition" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "normalizedCode" VARCHAR(100) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "categoryCode" VARCHAR(100),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "lifecycleState" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdByEmployeeId" INTEGER,
    "updatedByEmployeeId" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentPurposeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DocumentPurposeVersion" (
    "id" SERIAL NOT NULL,
    "definitionId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "normalizedCode" VARCHAR(100) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "categoryCode" VARCHAR(100),
    "isSystem" BOOLEAN NOT NULL,
    "lifecycleState" VARCHAR(24) NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "metadata" JSONB,
    "changeReason" TEXT,
    "snapshotHash" VARCHAR(64) NOT NULL,
    "createdByEmployeeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentPurposeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DocumentPurposeEvent" (
    "id" SERIAL NOT NULL,
    "definitionId" INTEGER NOT NULL,
    "versionId" INTEGER,
    "eventType" VARCHAR(50) NOT NULL,
    "previousState" VARCHAR(24),
    "resultingState" VARCHAR(24),
    "actorEmployeeId" INTEGER,
    "reasonCode" VARCHAR(100),
    "note" TEXT,
    "metadata" JSONB,
    "idempotencyKey" VARCHAR(160),
    "eventHash" VARCHAR(64) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentPurposeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentPurposeDefinition_branchId_lifecycleState_sortOrder_idx" ON "public"."DocumentPurposeDefinition"("branchId", "lifecycleState", "sortOrder");

-- CreateIndex
CREATE INDEX "DocumentPurposeDefinition_branchId_categoryCode_lifecycleSt_idx" ON "public"."DocumentPurposeDefinition"("branchId", "categoryCode", "lifecycleState");

-- CreateIndex
CREATE INDEX "DocumentPurposeDefinition_branchId_archivedAt_idx" ON "public"."DocumentPurposeDefinition"("branchId", "archivedAt");

-- CreateIndex
CREATE INDEX "DocumentPurposeDefinition_createdByEmployeeId_idx" ON "public"."DocumentPurposeDefinition"("createdByEmployeeId");

-- CreateIndex
CREATE INDEX "DocumentPurposeDefinition_updatedByEmployeeId_idx" ON "public"."DocumentPurposeDefinition"("updatedByEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPurposeDefinition_branchId_normalizedCode_key" ON "public"."DocumentPurposeDefinition"("branchId", "normalizedCode");

-- CreateIndex
CREATE INDEX "DocumentPurposeVersion_definitionId_createdAt_idx" ON "public"."DocumentPurposeVersion"("definitionId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentPurposeVersion_createdByEmployeeId_idx" ON "public"."DocumentPurposeVersion"("createdByEmployeeId");

-- CreateIndex
CREATE INDEX "DocumentPurposeVersion_snapshotHash_idx" ON "public"."DocumentPurposeVersion"("snapshotHash");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPurposeVersion_definitionId_version_key" ON "public"."DocumentPurposeVersion"("definitionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPurposeVersion_definitionId_snapshotHash_key" ON "public"."DocumentPurposeVersion"("definitionId", "snapshotHash");

-- CreateIndex
CREATE INDEX "DocumentPurposeEvent_definitionId_occurredAt_idx" ON "public"."DocumentPurposeEvent"("definitionId", "occurredAt");

-- CreateIndex
CREATE INDEX "DocumentPurposeEvent_versionId_idx" ON "public"."DocumentPurposeEvent"("versionId");

-- CreateIndex
CREATE INDEX "DocumentPurposeEvent_actorEmployeeId_idx" ON "public"."DocumentPurposeEvent"("actorEmployeeId");

-- CreateIndex
CREATE INDEX "DocumentPurposeEvent_eventType_occurredAt_idx" ON "public"."DocumentPurposeEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPurposeEvent_definitionId_eventHash_key" ON "public"."DocumentPurposeEvent"("definitionId", "eventHash");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPurposeEvent_definitionId_idempotencyKey_key" ON "public"."DocumentPurposeEvent"("definitionId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "public"."DocumentPurposeDefinition" ADD CONSTRAINT "DocumentPurposeDefinition_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentPurposeDefinition" ADD CONSTRAINT "DocumentPurposeDefinition_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentPurposeDefinition" ADD CONSTRAINT "DocumentPurposeDefinition_updatedByEmployeeId_fkey" FOREIGN KEY ("updatedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentPurposeVersion" ADD CONSTRAINT "DocumentPurposeVersion_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "public"."DocumentPurposeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentPurposeVersion" ADD CONSTRAINT "DocumentPurposeVersion_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentPurposeEvent" ADD CONSTRAINT "DocumentPurposeEvent_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "public"."DocumentPurposeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentPurposeEvent" ADD CONSTRAINT "DocumentPurposeEvent_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."DocumentPurposeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentPurposeEvent" ADD CONSTRAINT "DocumentPurposeEvent_actorEmployeeId_fkey" FOREIGN KEY ("actorEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
