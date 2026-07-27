const { Client } = require('pg');

const lockKey = 24072701;

const enumDefinitions = {
  DeviceCategory: [
    'DESKTOP_COMPUTER', 'NOTEBOOK', 'PRINTER', 'MONITOR', 'UPS',
    'NETWORK_DEVICE', 'MOBILE_DEVICE', 'TABLET', 'STORAGE_DEVICE',
    'ACCESSORY', 'OTHER',
  ],
  DeviceSourceType: [
    'SALE', 'SALE_RETURN', 'STOCK_ITEM', 'PURCHASE_RECEIPT',
    'DEVICE_OWNERSHIP', 'DEVICE_INTAKE', 'REPAIR_JOB',
    'REPAIR_DIAGNOSIS', 'REPAIR_PART', 'REPAIR_LABOR',
    'REPAIR_QUALITY_CHECK', 'REPAIR_DELIVERY', 'WARRANTY_CLAIM',
    'WARRANTY_CLAIM_EVENT', 'MANUAL', 'IMPORT', 'SYSTEM', 'OTHER',
  ],
  DeviceIntakeStatus: [
    'DRAFT', 'RECEIVED', 'INSPECTION_COMPLETED', 'LINKED_TO_REPAIR',
    'CANCELLED',
  ],
  DevicePriority: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
  AccessoryType: [
    'CHARGER', 'POWER_ADAPTER', 'CABLE', 'BATTERY', 'BAG_CASE',
    'SIM_CARD', 'MEMORY_CARD', 'OTHER',
  ],
  DeviceIntakeAuditEvent: [
    'CREATED', 'UPDATED', 'SNAPSHOT_RECORDED', 'CONDITION_RECORDED',
    'ACCESSORY_ADDED', 'ACCESSORY_REMOVED', 'CONSENT_SIGNED',
    'PHOTO_ADDED', 'DOCUMENT_ADDED', 'CHECKLIST_UPDATED',
    'LINKED_TO_REPAIR', 'STATUS_CHANGED', 'CANCELLED',
  ],
  DeviceStatus: [
    'ACTIVE', 'IN_REPAIR', 'IN_WARRANTY_CLAIM', 'RETIRED', 'LOST',
  ],
  DeviceOwnershipType: ['OWNER', 'CUSTODIAN', 'BORROWER'],
  DeviceActorType: ['EMPLOYEE', 'CUSTOMER', 'SYSTEM'],
  DevicePassportEventType: [
    'REGISTERED', 'OWNERSHIP_CHANGED', 'PURCHASED', 'SOLD', 'RETURNED',
    'INTAKE_CREATED', 'INTAKE_RECEIVED', 'INTAKE_INSPECTION_COMPLETED',
    'INTAKE_CANCELLED', 'REPAIR_CREATED', 'REPAIR_ASSIGNED',
    'REPAIR_STATUS_CHANGED', 'DIAGNOSIS_STARTED', 'DIAGNOSIS_COMPLETED',
    'DIAGNOSIS_REVISED', 'PART_ADDED', 'PART_REMOVED', 'LABOR_ADDED',
    'LABOR_COMPLETED', 'QC_STARTED', 'QC_PASSED', 'QC_FAILED',
    'DELIVERY_PREPARED', 'DELIVERED', 'WARRANTY_CLAIM_OPENED',
    'WARRANTY_CLAIM_SUBMITTED', 'WARRANTY_CLAIM_PROVIDER_RECEIVED',
    'WARRANTY_CLAIM_RESOLVED', 'WARRANTY_CLAIM_CANCELLED',
    'WARRANTY_REPLACED', 'WARRANTY_CREDITED', 'DEVICE_STATUS_CHANGED',
    'NOTE_ADDED', 'INTAKE', 'REPAIR_UPDATED', 'WARRANTY_CLAIM_UPDATED',
    'STATUS_CHANGED',
  ],
};

const foundationSql = `
CREATE TABLE IF NOT EXISTS "RepairTrackingAccess" (
  "id" SERIAL PRIMARY KEY,
  "repairJobId" INTEGER NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastAccessedAt" TIMESTAMP(3),
  "createdByEmployeeId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "RepairTrackingAccess_tokenHash_key"
  ON "RepairTrackingAccess"("tokenHash");
CREATE INDEX IF NOT EXISTS "RepairTrackingAccess_repairJobId_createdAt_idx"
  ON "RepairTrackingAccess"("repairJobId", "createdAt");
CREATE INDEX IF NOT EXISTS "RepairTrackingAccess_expiresAt_idx"
  ON "RepairTrackingAccess"("expiresAt");
CREATE INDEX IF NOT EXISTS "RepairTrackingAccess_revokedAt_idx"
  ON "RepairTrackingAccess"("revokedAt");

CREATE TABLE IF NOT EXISTS "Device" (
  "id" SERIAL PRIMARY KEY,
  "branchId" INTEGER NOT NULL,
  "currentOwnerCustomerId" INTEGER,
  "stockItemId" INTEGER,
  "fingerprint" TEXT NOT NULL,
  "category" "DeviceCategory",
  "brand" TEXT,
  "model" TEXT,
  "serialNumber" TEXT,
  "imei" TEXT,
  "barcode" TEXT,
  "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "Device_fingerprint_key"
  ON "Device"("fingerprint");
CREATE UNIQUE INDEX IF NOT EXISTS "Device_branchId_barcode_key"
  ON "Device"("branchId", "barcode");
CREATE INDEX IF NOT EXISTS "Device_branchId_idx" ON "Device"("branchId");
CREATE INDEX IF NOT EXISTS "Device_currentOwnerCustomerId_idx"
  ON "Device"("currentOwnerCustomerId");
CREATE INDEX IF NOT EXISTS "Device_stockItemId_idx" ON "Device"("stockItemId");
CREATE INDEX IF NOT EXISTS "Device_category_idx" ON "Device"("category");
CREATE INDEX IF NOT EXISTS "Device_status_idx" ON "Device"("status");

ALTER TABLE "RepairJob" ADD COLUMN IF NOT EXISTS "deviceId" INTEGER;
CREATE INDEX IF NOT EXISTS "RepairJob_deviceId_idx" ON "RepairJob"("deviceId");

ALTER TABLE "WarrantyClaim" ADD COLUMN IF NOT EXISTS "deviceId" INTEGER;
ALTER TABLE "WarrantyClaim" ALTER COLUMN "stockItemId" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "WarrantyClaim_deviceId_idx"
  ON "WarrantyClaim"("deviceId");

CREATE TABLE IF NOT EXISTS "DeviceIntake" (
  "id" SERIAL PRIMARY KEY,
  "deviceId" INTEGER NOT NULL,
  "branchId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "repairJobId" INTEGER,
  "receivedByEmployeeId" INTEGER NOT NULL,
  "referenceNo" TEXT NOT NULL,
  "customerProblem" TEXT NOT NULL,
  "internalRemark" TEXT,
  "status" "DeviceIntakeStatus" NOT NULL DEFAULT 'RECEIVED',
  "priority" "DevicePriority" NOT NULL DEFAULT 'NORMAL',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeviceIntake_repairJobId_key"
  ON "DeviceIntake"("repairJobId");
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceIntake_branchId_referenceNo_key"
  ON "DeviceIntake"("branchId", "referenceNo");
CREATE INDEX IF NOT EXISTS "DeviceIntake_deviceId_receivedAt_idx"
  ON "DeviceIntake"("deviceId", "receivedAt");
CREATE INDEX IF NOT EXISTS "DeviceIntake_branchId_status_receivedAt_idx"
  ON "DeviceIntake"("branchId", "status", "receivedAt");
CREATE INDEX IF NOT EXISTS "DeviceIntake_customerId_receivedAt_idx"
  ON "DeviceIntake"("customerId", "receivedAt");
CREATE INDEX IF NOT EXISTS "DeviceIntake_receivedByEmployeeId_receivedAt_idx"
  ON "DeviceIntake"("receivedByEmployeeId", "receivedAt");
CREATE INDEX IF NOT EXISTS "DeviceIntake_priority_status_idx"
  ON "DeviceIntake"("priority", "status");

CREATE TABLE IF NOT EXISTS "DeviceIntakeSnapshot" (
  "id" SERIAL PRIMARY KEY,
  "deviceIntakeId" INTEGER NOT NULL,
  "brand" TEXT,
  "model" TEXT,
  "serialNumber" TEXT,
  "imei" TEXT,
  "barcode" TEXT,
  "color" TEXT,
  "capacity" TEXT,
  "accessoriesSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceIntakeSnapshot_deviceIntakeId_key"
  ON "DeviceIntakeSnapshot"("deviceIntakeId");

CREATE TABLE IF NOT EXISTS "DeviceIntakeAccessory" (
  "id" SERIAL PRIMARY KEY,
  "deviceIntakeId" INTEGER NOT NULL,
  "accessoryType" "AccessoryType" NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "remark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "DeviceIntakeAccessory_deviceIntakeId_idx"
  ON "DeviceIntakeAccessory"("deviceIntakeId");
CREATE INDEX IF NOT EXISTS "DeviceIntakeAccessory_accessoryType_idx"
  ON "DeviceIntakeAccessory"("accessoryType");

CREATE TABLE IF NOT EXISTS "DeviceIntakeConsent" (
  "id" SERIAL PRIMARY KEY,
  "deviceIntakeId" INTEGER NOT NULL,
  "allowDataErase" BOOLEAN NOT NULL DEFAULT false,
  "allowFactoryReset" BOOLEAN NOT NULL DEFAULT false,
  "allowDisassembly" BOOLEAN NOT NULL DEFAULT false,
  "allowOutsourceRepair" BOOLEAN NOT NULL DEFAULT false,
  "customerSignature" TEXT,
  "signedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceIntakeConsent_deviceIntakeId_key"
  ON "DeviceIntakeConsent"("deviceIntakeId");

CREATE TABLE IF NOT EXISTS "DeviceIntakePhoto" (
  "id" SERIAL PRIMARY KEY,
  "deviceIntakeId" INTEGER NOT NULL,
  "url" TEXT NOT NULL,
  "storageKey" TEXT,
  "category" TEXT,
  "caption" TEXT,
  "uploadedByEmployeeId" INTEGER,
  "takenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "DeviceIntakePhoto_deviceIntakeId_createdAt_idx"
  ON "DeviceIntakePhoto"("deviceIntakeId", "createdAt");
CREATE INDEX IF NOT EXISTS "DeviceIntakePhoto_uploadedByEmployeeId_idx"
  ON "DeviceIntakePhoto"("uploadedByEmployeeId");

CREATE TABLE IF NOT EXISTS "DeviceIntakeAudit" (
  "id" SERIAL PRIMARY KEY,
  "deviceIntakeId" INTEGER NOT NULL,
  "eventType" "DeviceIntakeAuditEvent" NOT NULL,
  "performedByEmployeeId" INTEGER,
  "note" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "DeviceIntakeAudit_deviceIntakeId_occurredAt_idx"
  ON "DeviceIntakeAudit"("deviceIntakeId", "occurredAt");
CREATE INDEX IF NOT EXISTS "DeviceIntakeAudit_performedByEmployeeId_occurredAt_idx"
  ON "DeviceIntakeAudit"("performedByEmployeeId", "occurredAt");
CREATE INDEX IF NOT EXISTS "DeviceIntakeAudit_eventType_occurredAt_idx"
  ON "DeviceIntakeAudit"("eventType", "occurredAt");

CREATE TABLE IF NOT EXISTS "DeviceOwnershipHistory" (
  "id" SERIAL PRIMARY KEY,
  "deviceId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "ownershipType" "DeviceOwnershipType" NOT NULL,
  "sourceType" "DeviceSourceType",
  "sourceId" TEXT,
  "createdByEmployeeId" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "DeviceOwnershipHistory_deviceId_startedAt_idx"
  ON "DeviceOwnershipHistory"("deviceId", "startedAt");
CREATE INDEX IF NOT EXISTS "DeviceOwnershipHistory_deviceId_endedAt_idx"
  ON "DeviceOwnershipHistory"("deviceId", "endedAt");
CREATE INDEX IF NOT EXISTS "DeviceOwnershipHistory_customerId_startedAt_idx"
  ON "DeviceOwnershipHistory"("customerId", "startedAt");
CREATE INDEX IF NOT EXISTS "DeviceOwnershipHistory_sourceType_sourceId_idx"
  ON "DeviceOwnershipHistory"("sourceType", "sourceId");

CREATE TABLE IF NOT EXISTS "DevicePassportEvent" (
  "id" SERIAL PRIMARY KEY,
  "deviceId" INTEGER NOT NULL,
  "branchId" INTEGER NOT NULL,
  "eventType" "DevicePassportEventType" NOT NULL,
  "sourceType" "DeviceSourceType",
  "sourceId" TEXT,
  "eventKey" TEXT,
  "correlationId" TEXT,
  "causationId" TEXT,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "actorType" "DeviceActorType" NOT NULL,
  "actorEmployeeId" INTEGER,
  "actorCustomerId" INTEGER,
  "customerVisible" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DevicePassportEvent_deviceId_eventKey_key"
  ON "DevicePassportEvent"("deviceId", "eventKey");
CREATE INDEX IF NOT EXISTS "DevicePassportEvent_deviceId_occurredAt_idx"
  ON "DevicePassportEvent"("deviceId", "occurredAt");
CREATE INDEX IF NOT EXISTS "DevicePassportEvent_deviceId_eventType_occurredAt_idx"
  ON "DevicePassportEvent"("deviceId", "eventType", "occurredAt");
CREATE INDEX IF NOT EXISTS "DevicePassportEvent_branchId_eventType_occurredAt_idx"
  ON "DevicePassportEvent"("branchId", "eventType", "occurredAt");
CREATE INDEX IF NOT EXISTS "DevicePassportEvent_sourceType_sourceId_idx"
  ON "DevicePassportEvent"("sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "DevicePassportEvent_correlationId_occurredAt_idx"
  ON "DevicePassportEvent"("correlationId", "occurredAt");
CREATE INDEX IF NOT EXISTS "DevicePassportEvent_actorEmployeeId_idx"
  ON "DevicePassportEvent"("actorEmployeeId");
CREATE INDEX IF NOT EXISTS "DevicePassportEvent_actorCustomerId_idx"
  ON "DevicePassportEvent"("actorCustomerId");
`;

const foreignKeys = [
  ['RepairTrackingAccess_repairJobId_fkey', 'RepairTrackingAccess', 'repairJobId', 'RepairJob', 'id', 'CASCADE'],
  ['RepairTrackingAccess_createdByEmployeeId_fkey', 'RepairTrackingAccess', 'createdByEmployeeId', 'EmployeeProfile', 'id', 'SET NULL'],
  ['Device_branchId_fkey', 'Device', 'branchId', 'Branch', 'id', 'RESTRICT'],
  ['Device_currentOwnerCustomerId_fkey', 'Device', 'currentOwnerCustomerId', 'CustomerProfile', 'id', 'SET NULL'],
  ['Device_stockItemId_fkey', 'Device', 'stockItemId', 'StockItem', 'id', 'SET NULL'],
  ['RepairJob_deviceId_fkey', 'RepairJob', 'deviceId', 'Device', 'id', 'SET NULL'],
  ['WarrantyClaim_deviceId_fkey', 'WarrantyClaim', 'deviceId', 'Device', 'id', 'SET NULL'],
  ['DeviceIntake_deviceId_fkey', 'DeviceIntake', 'deviceId', 'Device', 'id', 'RESTRICT'],
  ['DeviceIntake_branchId_fkey', 'DeviceIntake', 'branchId', 'Branch', 'id', 'RESTRICT'],
  ['DeviceIntake_customerId_fkey', 'DeviceIntake', 'customerId', 'CustomerProfile', 'id', 'RESTRICT'],
  ['DeviceIntake_receivedByEmployeeId_fkey', 'DeviceIntake', 'receivedByEmployeeId', 'EmployeeProfile', 'id', 'RESTRICT'],
  ['DeviceIntake_repairJobId_fkey', 'DeviceIntake', 'repairJobId', 'RepairJob', 'id', 'SET NULL'],
  ['DeviceIntakeSnapshot_deviceIntakeId_fkey', 'DeviceIntakeSnapshot', 'deviceIntakeId', 'DeviceIntake', 'id', 'CASCADE'],
  ['DeviceIntakeAccessory_deviceIntakeId_fkey', 'DeviceIntakeAccessory', 'deviceIntakeId', 'DeviceIntake', 'id', 'CASCADE'],
  ['DeviceIntakeConsent_deviceIntakeId_fkey', 'DeviceIntakeConsent', 'deviceIntakeId', 'DeviceIntake', 'id', 'CASCADE'],
  ['DeviceIntakePhoto_deviceIntakeId_fkey', 'DeviceIntakePhoto', 'deviceIntakeId', 'DeviceIntake', 'id', 'CASCADE'],
  ['DeviceIntakePhoto_uploadedByEmployeeId_fkey', 'DeviceIntakePhoto', 'uploadedByEmployeeId', 'EmployeeProfile', 'id', 'SET NULL'],
  ['DeviceIntakeAudit_deviceIntakeId_fkey', 'DeviceIntakeAudit', 'deviceIntakeId', 'DeviceIntake', 'id', 'CASCADE'],
  ['DeviceIntakeAudit_performedByEmployeeId_fkey', 'DeviceIntakeAudit', 'performedByEmployeeId', 'EmployeeProfile', 'id', 'SET NULL'],
  ['DeviceOwnershipHistory_deviceId_fkey', 'DeviceOwnershipHistory', 'deviceId', 'Device', 'id', 'RESTRICT'],
  ['DeviceOwnershipHistory_customerId_fkey', 'DeviceOwnershipHistory', 'customerId', 'CustomerProfile', 'id', 'RESTRICT'],
  ['DeviceOwnershipHistory_createdByEmployeeId_fkey', 'DeviceOwnershipHistory', 'createdByEmployeeId', 'EmployeeProfile', 'id', 'SET NULL'],
  ['DevicePassportEvent_deviceId_fkey', 'DevicePassportEvent', 'deviceId', 'Device', 'id', 'RESTRICT'],
  ['DevicePassportEvent_branchId_fkey', 'DevicePassportEvent', 'branchId', 'Branch', 'id', 'RESTRICT'],
  ['DevicePassportEvent_actorEmployeeId_fkey', 'DevicePassportEvent', 'actorEmployeeId', 'EmployeeProfile', 'id', 'SET NULL'],
  ['DevicePassportEvent_actorCustomerId_fkey', 'DevicePassportEvent', 'actorCustomerId', 'CustomerProfile', 'id', 'SET NULL'],
];

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function ensureEnums(client) {
  for (const [name, values] of Object.entries(enumDefinitions)) {
    const found = await client.query(
      'SELECT 1 FROM pg_type WHERE typname = $1',
      [name]
    );
    if (!found.rowCount) {
      const labels = values.map(quoteLiteral).join(', ');
      await client.query(`CREATE TYPE ${quoteIdentifier(name)} AS ENUM (${labels})`);
      continue;
    }
    for (const value of values) {
      await client.query(
        `ALTER TYPE ${quoteIdentifier(name)} ADD VALUE IF NOT EXISTS ${quoteLiteral(value)}`
      );
    }
  }
}

async function ensureForeignKeys(client) {
  for (const [name, table, column, target, targetColumn, onDelete] of foreignKeys) {
    const found = await client.query(
      'SELECT 1 FROM pg_constraint WHERE conname = $1',
      [name]
    );
    if (found.rowCount) continue;
    await client.query(
      `ALTER TABLE ${quoteIdentifier(table)}
       ADD CONSTRAINT ${quoteIdentifier(name)}
       FOREIGN KEY (${quoteIdentifier(column)})
       REFERENCES ${quoteIdentifier(target)}(${quoteIdentifier(targetColumn)})
       ON DELETE ${onDelete} ON UPDATE CASCADE`
    );
  }
}

async function assertBaseTables(client) {
  const required = [
    'Branch', 'CustomerProfile', 'EmployeeProfile', 'StockItem',
    'RepairJob', 'WarrantyClaim',
  ];
  const result = await client.query(
    `SELECT name
       FROM unnest($1::text[]) AS name
      WHERE to_regclass('public."' || name || '"') IS NULL`,
    [required]
  );
  if (result.rows.length) {
    throw new Error(
      `Cannot apply device foundation: missing base tables ${result.rows.map(({ name }) => name).join(', ')}`
    );
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL is required');
  }

  const client = new Client({
    connectionString,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : undefined,
  });

  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [lockKey]);
    await assertBaseTables(client);
    await ensureEnums(client);

    await client.query('BEGIN');
    try {
      await client.query(foundationSql);
      await ensureForeignKeys(client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const verification = await client.query(`
      SELECT
        to_regclass('public."Device"') IS NOT NULL AS device,
        to_regclass('public."RepairTrackingAccess"') IS NOT NULL AS repair_tracking_access,
        to_regclass('public."RepairTrackingAccess_tokenHash_key"') IS NOT NULL AS tracking_token_identity,
        to_regclass('public."DeviceIntake"') IS NOT NULL AS intake,
        to_regclass('public."DeviceIntakeConsent"') IS NOT NULL AS intake_consent,
        to_regclass('public."DeviceIntakePhoto"') IS NOT NULL AS intake_photo,
        to_regclass('public."DeviceIntakeAudit"') IS NOT NULL AS intake_audit,
        to_regclass('public."Device_branchId_barcode_key"') IS NOT NULL AS device_barcode_identity,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'RepairJob'
            AND column_name = 'deviceId'
        ) AS repair_job_device,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'WarrantyClaim'
            AND column_name = 'deviceId'
        ) AS warranty_claim_device,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'WarrantyClaim'
            AND column_name = 'stockItemId'
            AND is_nullable = 'YES'
        ) AS warranty_claim_stock_optional
    `);
    if (!Object.values(verification.rows[0]).every(Boolean)) {
      throw new Error('Device foundation verification failed');
    }
    console.log('[db] Device intake and customer tracking foundation is ready');
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
    } finally {
      await client.end();
    }
  }
}

main().catch((error) => {
  console.error('[db] Device intake foundation failed:', error.message);
  process.exitCode = 1;
});
