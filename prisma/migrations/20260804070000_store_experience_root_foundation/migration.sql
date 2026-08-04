-- Store Experience Root Foundation
-- Additive only: no backfill, no mutation of existing tenant/store data.

CREATE TYPE "StoreExperienceProfileStatus" AS ENUM (
  'DRAFT',
  'READY',
  'PUBLISHED',
  'SUSPENDED'
);

CREATE TABLE "StoreExperienceProfile" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "status" "StoreExperienceProfileStatus" NOT NULL DEFAULT 'DRAFT',
  "themePreset" VARCHAR(80) NOT NULL DEFAULT 'platform-default',
  "themeTokens" JSONB,
  "layoutPreset" VARCHAR(80) NOT NULL DEFAULT 'platform-default',
  "sectionConfiguration" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StoreExperienceProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreExperienceProfile_branchId_key"
  ON "StoreExperienceProfile"("branchId");

CREATE INDEX "StoreExperienceProfile_status_idx"
  ON "StoreExperienceProfile"("status");

CREATE INDEX "StoreExperienceProfile_publishedAt_idx"
  ON "StoreExperienceProfile"("publishedAt");

ALTER TABLE "StoreExperienceProfile"
  ADD CONSTRAINT "StoreExperienceProfile_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
