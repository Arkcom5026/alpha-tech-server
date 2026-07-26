CREATE TABLE "Device" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "currentOwnerCustomerId" INTEGER,
  "stockItemId" INTEGER,
  "fingerprint" VARCHAR(128) NOT NULL,
  "deviceType" VARCHAR(120),
  "brand" VARCHAR(120),
  "model" VARCHAR(180) NOT NULL,
  "serialNumber" VARCHAR(180),
  "imei" VARCHAR(80),
  "barcode" VARCHAR(180),
  "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Device_status_check" CHECK ("status" IN ('ACTIVE','ARCHIVED','REPLACED'))
);

CREATE UNIQUE INDEX "Device_fingerprint_key" ON "Device"("fingerprint");
CREATE UNIQUE INDEX "Device_stockItemId_key" ON "Device"("stockItemId") WHERE "stockItemId" IS NOT NULL;
CREATE INDEX "Device_branchId_status_createdAt_idx" ON "Device"("branchId","status","createdAt");
CREATE INDEX "Device_currentOwnerCustomerId_updatedAt_idx" ON "Device"("currentOwnerCustomerId","updatedAt");
CREATE INDEX "Device_serialNumber_idx" ON "Device"("serialNumber");
CREATE INDEX "Device_imei_idx" ON "Device"("imei");
CREATE INDEX "Device_barcode_idx" ON "Device"("barcode");

CREATE TABLE "DeviceOwnershipHistory" (
  "id" SERIAL NOT NULL,
  "deviceId" INTEGER NOT NULL,
  "customerId" INTEGER,
  "ownershipType" VARCHAR(24) NOT NULL DEFAULT 'CUSTOMER',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "sourceType" VARCHAR(40),
  "sourceId" INTEGER,
  "createdByEmployeeId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceOwnershipHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceOwnershipHistory_ownershipType_check" CHECK ("ownershipType" IN ('CUSTOMER','STORE','SUPPLIER','UNKNOWN'))
);

CREATE INDEX "DeviceOwnershipHistory_deviceId_startedAt_idx" ON "DeviceOwnershipHistory"("deviceId","startedAt");
CREATE INDEX "DeviceOwnershipHistory_customerId_startedAt_idx" ON "DeviceOwnershipHistory"("customerId","startedAt");

ALTER TABLE "DeviceIntake" ADD COLUMN "deviceId" INTEGER;
ALTER TABLE "RepairJob" ADD COLUMN "deviceId" INTEGER;
ALTER TABLE "WarrantyClaim" ADD COLUMN "deviceId" INTEGER;

CREATE INDEX "DeviceIntake_deviceId_createdAt_idx" ON "DeviceIntake"("deviceId","createdAt");
CREATE INDEX "RepairJob_deviceId_createdAt_idx" ON "RepairJob"("deviceId","createdAt");
CREATE INDEX "WarrantyClaim_deviceId_openedAt_idx" ON "WarrantyClaim"("deviceId","openedAt");

ALTER TABLE "Device" ADD CONSTRAINT "Device_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Device" ADD CONSTRAINT "Device_currentOwnerCustomerId_fkey" FOREIGN KEY ("currentOwnerCustomerId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Device" ADD CONSTRAINT "Device_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeviceOwnershipHistory" ADD CONSTRAINT "DeviceOwnershipHistory_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceOwnershipHistory" ADD CONSTRAINT "DeviceOwnershipHistory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeviceOwnershipHistory" ADD CONSTRAINT "DeviceOwnershipHistory_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeviceIntake" ADD CONSTRAINT "DeviceIntake_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RepairJob" ADD CONSTRAINT "RepairJob_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
