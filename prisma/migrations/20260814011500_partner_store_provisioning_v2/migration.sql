CREATE TYPE "PartnerStoreProvisioningStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'PROVISIONED',
  'FAILED'
);

ALTER TYPE "PartnerStoreApplicationEventType" ADD VALUE IF NOT EXISTS 'PROVISIONING_STARTED';
ALTER TYPE "PartnerStoreApplicationEventType" ADD VALUE IF NOT EXISTS 'STORE_PROVISIONED';
ALTER TYPE "PartnerStoreApplicationEventType" ADD VALUE IF NOT EXISTS 'PROVISIONING_FAILED';

ALTER TABLE "PartnerStoreApplication"
  ADD COLUMN "provisioningStatus" "PartnerStoreProvisioningStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "provisioningAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "provisionedAt" TIMESTAMP(3),
  ADD COLUMN "provisioningFailureCode" TEXT;

ALTER TABLE "PartnerStoreApplicationEvent"
  ADD COLUMN "previousProvisioningStatus" "PartnerStoreProvisioningStatus",
  ADD COLUMN "resultingProvisioningStatus" "PartnerStoreProvisioningStatus";

CREATE INDEX "PartnerStoreApplication_provisioningStatus_createdAt_idx"
  ON "PartnerStoreApplication"("provisioningStatus", "createdAt");
