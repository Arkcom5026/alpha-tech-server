-- Store Experience Published Snapshot Foundation
-- Additive only: no backfill, destructive mutation, or existing-row rewrite.

ALTER TABLE "StoreExperienceProfile"
  ADD COLUMN "contentConfiguration" JSONB,
  ADD COLUMN "publishedThemePreset" VARCHAR(80),
  ADD COLUMN "publishedThemeTokens" JSONB,
  ADD COLUMN "publishedLayoutPreset" VARCHAR(80),
  ADD COLUMN "publishedSectionConfiguration" JSONB,
  ADD COLUMN "publishedContentConfiguration" JSONB,
  ADD COLUMN "publishedVersion" INTEGER;
