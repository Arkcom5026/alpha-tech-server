CREATE TYPE "PartnerStoreOnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

ALTER TYPE "PartnerStoreApplicationEventType" ADD VALUE IF NOT EXISTS 'OWNER_FIRST_LOGIN';
ALTER TYPE "PartnerStoreApplicationEventType" ADD VALUE IF NOT EXISTS 'ONBOARDING_STARTED';
ALTER TYPE "PartnerStoreApplicationEventType" ADD VALUE IF NOT EXISTS 'ONBOARDING_COMPLETED';

ALTER TABLE "PartnerStoreApplication"
  ADD COLUMN "onboardingStatus" "PartnerStoreOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "firstLoginAt" TIMESTAMP(3),
  ADD COLUMN "onboardingStartedAt" TIMESTAMP(3),
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

ALTER TABLE "PartnerStoreApplicationEvent"
  ADD COLUMN "previousOnboardingStatus" "PartnerStoreOnboardingStatus",
  ADD COLUMN "resultingOnboardingStatus" "PartnerStoreOnboardingStatus";

CREATE INDEX "PartnerStoreApplication_onboardingStatus_createdAt_idx"
  ON "PartnerStoreApplication"("onboardingStatus", "createdAt");
