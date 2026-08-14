CREATE TYPE "PartnerStoreOperationalReadinessStatus" AS ENUM ('NOT_READY', 'CERTIFIED');

ALTER TYPE "PartnerStoreApplicationEventType" ADD VALUE 'OPERATIONAL_CERTIFIED';

ALTER TABLE "PartnerStoreApplication"
  ADD COLUMN "operationalReadinessStatus" "PartnerStoreOperationalReadinessStatus" NOT NULL DEFAULT 'NOT_READY',
  ADD COLUMN "operationalCertifiedAt" TIMESTAMP(3),
  ADD COLUMN "operationalCertifiedByUserId" INTEGER,
  ADD COLUMN "operationalCertificationSnapshot" JSONB;

ALTER TABLE "PartnerStoreApplicationEvent"
  ADD COLUMN "previousOperationalReadinessStatus" "PartnerStoreOperationalReadinessStatus",
  ADD COLUMN "resultingOperationalReadinessStatus" "PartnerStoreOperationalReadinessStatus";

CREATE INDEX "PartnerStoreApplication_operationalReadinessStatus_createdAt_idx"
  ON "PartnerStoreApplication"("operationalReadinessStatus", "createdAt");
