-- Store Experience Published Snapshot Legacy Backfill
-- Recovery-safe compatibility migration for storefronts published before snapshot columns existed.
-- Only rows already marked PUBLISHED and still missing a published snapshot are updated.
-- Existing published snapshots are never overwritten.

UPDATE "StoreExperienceProfile"
SET
  "publishedThemePreset" = "themePreset",
  "publishedThemeTokens" = "themeTokens",
  "publishedLayoutPreset" = "layoutPreset",
  "publishedSectionConfiguration" = "sectionConfiguration",
  "publishedContentConfiguration" = "contentConfiguration",
  "publishedVersion" = "version"
WHERE "status" = 'PUBLISHED'
  AND "publishedVersion" IS NULL;
