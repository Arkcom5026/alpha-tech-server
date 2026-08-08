-- Document-to-printer routing foundation. Additive only; no data backfill.

CREATE TABLE "PrintDeviceProfile" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "normalizedCode" VARCHAR(100) NOT NULL,
  "displayName" VARCHAR(160) NOT NULL,
  "manufacturer" VARCHAR(120),
  "modelName" VARCHAR(160),
  "capabilities" JSONB NOT NULL,
  "paperProfile" JSONB,
  "adapterKind" VARCHAR(80),
  "transportKind" VARCHAR(80),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrintDeviceProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentPurposePrintRoute" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "definitionId" INTEGER NOT NULL,
  "printerProfileId" INTEGER NOT NULL,
  "requiredCapability" VARCHAR(40) NOT NULL DEFAULT 'PRINT',
  "copies" INTEGER NOT NULL DEFAULT 1,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentPurposePrintRoute_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentPurposePrintRoute_copies_check" CHECK ("copies" BETWEEN 1 AND 20)
);

CREATE UNIQUE INDEX "PrintDeviceProfile_branch_normalizedCode_key"
  ON "PrintDeviceProfile"("branchId", "normalizedCode");
CREATE UNIQUE INDEX "DocumentPurposeDefinition_branch_id_key"
  ON "DocumentPurposeDefinition"("branchId", "id");
CREATE UNIQUE INDEX "PrintDeviceProfile_branch_id_key"
  ON "PrintDeviceProfile"("branchId", "id");
CREATE INDEX "PrintDeviceProfile_branch_active_name_idx"
  ON "PrintDeviceProfile"("branchId", "isActive", "displayName");
CREATE UNIQUE INDEX "DocumentPurposePrintRoute_branch_definition_key"
  ON "DocumentPurposePrintRoute"("branchId", "definitionId");
CREATE INDEX "DocumentPurposePrintRoute_branch_profile_active_idx"
  ON "DocumentPurposePrintRoute"("branchId", "printerProfileId", "isActive");

ALTER TABLE "PrintDeviceProfile"
  ADD CONSTRAINT "PrintDeviceProfile_branch_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentPurposePrintRoute"
  ADD CONSTRAINT "DocumentPurposePrintRoute_branch_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentPurposePrintRoute"
  ADD CONSTRAINT "DocumentPurposePrintRoute_definition_fkey"
  FOREIGN KEY ("branchId", "definitionId") REFERENCES "DocumentPurposeDefinition"("branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentPurposePrintRoute"
  ADD CONSTRAINT "DocumentPurposePrintRoute_printerProfile_fkey"
  FOREIGN KEY ("branchId", "printerProfileId") REFERENCES "PrintDeviceProfile"("branchId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
