CREATE TYPE "PartnerStoreActivationStatus" AS ENUM ('NOT_STARTED', 'INVITED', 'ACTIVE');

ALTER TYPE "PartnerStoreApplicationEventType" ADD VALUE IF NOT EXISTS 'ACTIVATION_INVITATION_ISSUED';
ALTER TYPE "PartnerStoreApplicationEventType" ADD VALUE IF NOT EXISTS 'OWNER_ACTIVATED';

ALTER TABLE "PartnerStoreApplication"
  ADD COLUMN "activationStatus" "PartnerStoreActivationStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "activatedAt" TIMESTAMP(3);

ALTER TABLE "PartnerStoreApplicationEvent"
  ADD COLUMN "previousActivationStatus" "PartnerStoreActivationStatus",
  ADD COLUMN "resultingActivationStatus" "PartnerStoreActivationStatus";

CREATE TABLE "PartnerStoreActivationInvitation" (
  "id" SERIAL NOT NULL,
  "applicationId" INTEGER NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "createdByUserId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerStoreActivationInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerStoreActivationInvitation_tokenHash_key"
  ON "PartnerStoreActivationInvitation"("tokenHash");
CREATE INDEX "PartnerStoreActivationInvitation_applicationId_createdAt_idx"
  ON "PartnerStoreActivationInvitation"("applicationId", "createdAt");
CREATE INDEX "PartnerStoreActivationInvitation_expiresAt_idx"
  ON "PartnerStoreActivationInvitation"("expiresAt");
CREATE INDEX "PartnerStoreActivationInvitation_revokedAt_idx"
  ON "PartnerStoreActivationInvitation"("revokedAt");
CREATE INDEX "PartnerStoreActivationInvitation_consumedAt_idx"
  ON "PartnerStoreActivationInvitation"("consumedAt");
CREATE INDEX "PartnerStoreApplication_activationStatus_createdAt_idx"
  ON "PartnerStoreApplication"("activationStatus", "createdAt");

ALTER TABLE "PartnerStoreActivationInvitation"
  ADD CONSTRAINT "PartnerStoreActivationInvitation_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "PartnerStoreApplication"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
