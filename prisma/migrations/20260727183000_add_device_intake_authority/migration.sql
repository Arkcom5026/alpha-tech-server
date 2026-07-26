CREATE TABLE "DeviceIntake" (
  "id" SERIAL NOT NULL,
  "intakeNo" VARCHAR(40) NOT NULL,
  "branchId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "stockItemId" INTEGER,
  "purpose" VARCHAR(32) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  "reportedSymptoms" TEXT,
  "createdByEmployeeId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceIntake_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceIntake_purpose_check" CHECK ("purpose" IN ('REPAIR','CLAIM','INSPECTION','TRADE_IN','UPGRADE','DATA_RECOVERY','MAINTENANCE')),
  CONSTRAINT "DeviceIntake_status_check" CHECK ("status" IN ('DRAFT','AWAITING_CUSTOMER_CONFIRMATION','CONFIRMED','CANCELLED'))
);

CREATE UNIQUE INDEX "DeviceIntake_intakeNo_key" ON "DeviceIntake"("intakeNo");
CREATE INDEX "DeviceIntake_branchId_status_createdAt_idx" ON "DeviceIntake"("branchId","status","createdAt");
CREATE INDEX "DeviceIntake_customerId_createdAt_idx" ON "DeviceIntake"("customerId","createdAt");
CREATE INDEX "DeviceIntake_stockItemId_createdAt_idx" ON "DeviceIntake"("stockItemId","createdAt");

CREATE TABLE "DeviceIntakeSnapshot" (
  "id" SERIAL NOT NULL,
  "deviceIntakeId" INTEGER NOT NULL,
  "deviceType" VARCHAR(120),
  "brand" VARCHAR(120),
  "model" VARCHAR(180) NOT NULL,
  "serialNumber" VARCHAR(180),
  "imei" VARCHAR(80),
  "barcode" VARCHAR(180),
  "color" VARCHAR(80),
  "capacity" VARCHAR(120),
  "specification" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceIntakeSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeviceIntakeSnapshot_deviceIntakeId_key" ON "DeviceIntakeSnapshot"("deviceIntakeId");

CREATE TABLE "DeviceIntakeCondition" (
  "id" SERIAL NOT NULL,
  "deviceIntakeId" INTEGER NOT NULL,
  "screenCrack" BOOLEAN NOT NULL DEFAULT FALSE,
  "housingDamage" BOOLEAN NOT NULL DEFAULT FALSE,
  "scratch" BOOLEAN NOT NULL DEFAULT FALSE,
  "waterDamage" BOOLEAN NOT NULL DEFAULT FALSE,
  "missingScrews" BOOLEAN NOT NULL DEFAULT FALSE,
  "missingParts" BOOLEAN NOT NULL DEFAULT FALSE,
  "overallCondition" VARCHAR(32),
  "remark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceIntakeCondition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeviceIntakeCondition_deviceIntakeId_key" ON "DeviceIntakeCondition"("deviceIntakeId");

CREATE TABLE "DeviceIntakeAccessory" (
  "id" SERIAL NOT NULL,
  "deviceIntakeId" INTEGER NOT NULL,
  "type" VARCHAR(80) NOT NULL,
  "description" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "returnedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceIntakeAccessory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceIntakeAccessory_quantity_check" CHECK ("quantity" > 0)
);
CREATE INDEX "DeviceIntakeAccessory_deviceIntakeId_createdAt_idx" ON "DeviceIntakeAccessory"("deviceIntakeId","createdAt");

CREATE TABLE "DeviceIntakePhoto" (
  "id" SERIAL NOT NULL,
  "deviceIntakeId" INTEGER NOT NULL,
  "type" VARCHAR(32) NOT NULL,
  "url" TEXT NOT NULL,
  "publicId" VARCHAR(255),
  "caption" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceIntakePhoto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceIntakePhoto_type_check" CHECK ("type" IN ('FRONT','BACK','SERIAL','DAMAGE','ACCESSORY','SCREEN','OTHER'))
);
CREATE INDEX "DeviceIntakePhoto_deviceIntakeId_type_createdAt_idx" ON "DeviceIntakePhoto"("deviceIntakeId","type","createdAt");

CREATE TABLE "DeviceIntakeConsent" (
  "id" SERIAL NOT NULL,
  "deviceIntakeId" INTEGER NOT NULL,
  "allowDisassembly" BOOLEAN NOT NULL DEFAULT FALSE,
  "allowDataReset" BOOLEAN NOT NULL DEFAULT FALSE,
  "allowBackup" BOOLEAN NOT NULL DEFAULT FALSE,
  "allowNotifications" BOOLEAN NOT NULL DEFAULT TRUE,
  "allowTracking" BOOLEAN NOT NULL DEFAULT TRUE,
  "allowWarrantyCheck" BOOLEAN NOT NULL DEFAULT TRUE,
  "agreedTerms" BOOLEAN NOT NULL DEFAULT FALSE,
  "termsVersion" VARCHAR(40),
  "agreedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceIntakeConsent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeviceIntakeConsent_deviceIntakeId_key" ON "DeviceIntakeConsent"("deviceIntakeId");

CREATE TABLE "DeviceIntakeConfirmation" (
  "id" SERIAL NOT NULL,
  "deviceIntakeId" INTEGER NOT NULL,
  "method" VARCHAR(24) NOT NULL,
  "confirmedByName" VARCHAR(180),
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evidenceHash" VARCHAR(128),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceIntakeConfirmation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceIntakeConfirmation_method_check" CHECK ("method" IN ('SIGNATURE','OTP','LINE','EMAIL','STAFF_VERIFIED'))
);
CREATE UNIQUE INDEX "DeviceIntakeConfirmation_deviceIntakeId_key" ON "DeviceIntakeConfirmation"("deviceIntakeId");

CREATE TABLE "DeviceIntakeAudit" (
  "id" SERIAL NOT NULL,
  "deviceIntakeId" INTEGER NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "actorType" VARCHAR(24) NOT NULL,
  "employeeId" INTEGER,
  "ipAddress" VARCHAR(80),
  "userAgent" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceIntakeAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DeviceIntakeAudit_deviceIntakeId_occurredAt_idx" ON "DeviceIntakeAudit"("deviceIntakeId","occurredAt");
CREATE INDEX "DeviceIntakeAudit_employeeId_occurredAt_idx" ON "DeviceIntakeAudit"("employeeId","occurredAt");

ALTER TABLE "RepairJob" ADD COLUMN "deviceIntakeId" INTEGER;
ALTER TABLE "WarrantyClaim" ADD COLUMN "deviceIntakeId" INTEGER;
CREATE INDEX "RepairJob_deviceIntakeId_idx" ON "RepairJob"("deviceIntakeId");
CREATE INDEX "WarrantyClaim_deviceIntakeId_idx" ON "WarrantyClaim"("deviceIntakeId");

ALTER TABLE "DeviceIntake" ADD CONSTRAINT "DeviceIntake_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviceIntake" ADD CONSTRAINT "DeviceIntake_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviceIntake" ADD CONSTRAINT "DeviceIntake_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviceIntake" ADD CONSTRAINT "DeviceIntake_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviceIntakeSnapshot" ADD CONSTRAINT "DeviceIntakeSnapshot_deviceIntakeId_fkey" FOREIGN KEY ("deviceIntakeId") REFERENCES "DeviceIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceIntakeCondition" ADD CONSTRAINT "DeviceIntakeCondition_deviceIntakeId_fkey" FOREIGN KEY ("deviceIntakeId") REFERENCES "DeviceIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceIntakeAccessory" ADD CONSTRAINT "DeviceIntakeAccessory_deviceIntakeId_fkey" FOREIGN KEY ("deviceIntakeId") REFERENCES "DeviceIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceIntakePhoto" ADD CONSTRAINT "DeviceIntakePhoto_deviceIntakeId_fkey" FOREIGN KEY ("deviceIntakeId") REFERENCES "DeviceIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceIntakeConsent" ADD CONSTRAINT "DeviceIntakeConsent_deviceIntakeId_fkey" FOREIGN KEY ("deviceIntakeId") REFERENCES "DeviceIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceIntakeConfirmation" ADD CONSTRAINT "DeviceIntakeConfirmation_deviceIntakeId_fkey" FOREIGN KEY ("deviceIntakeId") REFERENCES "DeviceIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceIntakeAudit" ADD CONSTRAINT "DeviceIntakeAudit_deviceIntakeId_fkey" FOREIGN KEY ("deviceIntakeId") REFERENCES "DeviceIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceIntakeAudit" ADD CONSTRAINT "DeviceIntakeAudit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RepairJob" ADD CONSTRAINT "RepairJob_deviceIntakeId_fkey" FOREIGN KEY ("deviceIntakeId") REFERENCES "DeviceIntake"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_deviceIntakeId_fkey" FOREIGN KEY ("deviceIntakeId") REFERENCES "DeviceIntake"("id") ON DELETE SET NULL ON UPDATE CASCADE;