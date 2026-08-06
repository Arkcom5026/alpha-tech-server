import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const migrationPath = path.join(
  root,
  'prisma/migrations/20260806112000_store_experience_published_snapshot_backfill/migration.sql'
);

assert.ok(fs.existsSync(migrationPath), 'legacy published snapshot backfill migration missing');
const migration = fs.readFileSync(migrationPath, 'utf8');

const includes = (value, label) =>
  assert.ok(migration.includes(value), `${label} missing: ${value}`);

includes('UPDATE "StoreExperienceProfile"', 'targeted profile update');
includes('"publishedThemePreset" = "themePreset"', 'theme snapshot copy');
includes('"publishedThemeTokens" = "themeTokens"', 'token snapshot copy');
includes('"publishedLayoutPreset" = "layoutPreset"', 'layout snapshot copy');
includes('"publishedSectionConfiguration" = "sectionConfiguration"', 'section snapshot copy');
includes('"publishedContentConfiguration" = "contentConfiguration"', 'content snapshot copy');
includes('"publishedVersion" = "version"', 'version snapshot copy');
includes('WHERE "status" = \'PUBLISHED\'', 'published-only guard');
includes('AND "publishedVersion" IS NULL', 'missing-snapshot-only guard');

assert.doesNotMatch(migration, /DROP\s+(COLUMN|TABLE)|DELETE\s+FROM|TRUNCATE/i, 'backfill must not be destructive');
assert.doesNotMatch(migration, /WHERE[\s\S]*"status"\s*<>\s*'PUBLISHED'/i, 'backfill must not target non-published profiles');
assert.equal((migration.match(/UPDATE\s+"StoreExperienceProfile"/gi) || []).length, 1, 'backfill must use one guarded update');

console.log('store experience published snapshot backfill contract: PASS');
