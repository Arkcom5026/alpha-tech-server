-- Store Device Registry durable persistence
-- Additive only. No backfill and no mutation of existing business data.

CREATE TABLE "StoreDeviceRegistryDevice" (
  "id" BIGSERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "gatewayId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "connectionState" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "capabilities" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "transportKind" TEXT,
  "adapterKind" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "workstationId" TEXT,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),

  CONSTRAINT "StoreDeviceRegistryDevice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreDeviceRegistryDevice_kind_check" CHECK ("kind" IN ('PRINTER','SCANNER','CASH_DRAWER','CUSTOMER_DISPLAY','SCALE','RFID','NFC','SIGNATURE_PAD','CARD_READER','CAMERA')),
  CONSTRAINT "StoreDeviceRegistryDevice_connection_state_check" CHECK ("connectionState" IN ('UNKNOWN','ONLINE','OFFLINE','ERROR','REVOKED')),
  CONSTRAINT "StoreDeviceRegistryDevice_revoked_state_check" CHECK ("revokedAt" IS NULL OR "connectionState" = 'REVOKED')
);

CREATE UNIQUE INDEX "StoreDeviceRegistryDevice_branch_device_key"
  ON "StoreDeviceRegistryDevice" ("branchId", "deviceId");

CREATE INDEX "StoreDeviceRegistryDevice_branch_gateway_idx"
  ON "StoreDeviceRegistryDevice" ("branchId", "gatewayId");

CREATE INDEX "StoreDeviceRegistryDevice_branch_workstation_idx"
  ON "StoreDeviceRegistryDevice" ("branchId", "workstationId")
  WHERE "workstationId" IS NOT NULL;

ALTER TABLE "StoreDeviceRegistryDevice"
  ADD CONSTRAINT "StoreDeviceRegistryDevice_branch_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StoreDeviceRegistryDevice"
  ADD CONSTRAINT "StoreDeviceRegistryDevice_branch_gateway_fkey"
  FOREIGN KEY ("branchId", "gatewayId")
  REFERENCES "StoreDeviceGateway"("branchId", "gatewayId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
