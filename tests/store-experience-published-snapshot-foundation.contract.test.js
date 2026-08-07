import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import schemaReader from '../scripts/read-prisma-schema-source.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const schema = schemaReader.readPrismaSchemaSource(root);
const service = read('src/modules/storeExperience/draft/storeExperienceDraftService.js');
const repository = read('src/modules/storeExperience/draft/storeExperienceDraftRepository.js');
const publicRepository = read('src/modules/sales/storefront/public/publicStorefrontRepository.js');
const migrationPath = path.join(root, 'prisma/migrations/20260805190000_store_experience_published_snapshot_foundation/migration.sql');

const includes = (source, value, label) => assert.ok(source.includes(value), `${label} missing: ${value}`);

includes(schema, 'contentConfiguration', 'editable merchant content');
includes(schema, 'publishedThemePreset', 'published theme snapshot');
includes(schema, 'publishedThemeTokens', 'published token snapshot');
includes(schema, 'publishedLayoutPreset', 'published layout snapshot');
includes(schema, 'publishedSectionConfiguration', 'published section snapshot');
includes(schema, 'publishedContentConfiguration', 'published content snapshot');
includes(schema, 'publishedVersion', 'published version authority');

assert.ok(fs.existsSync(migrationPath), 'additive published snapshot migration missing');
const migration = read('prisma/migrations/20260805190000_store_experience_published_snapshot_foundation/migration.sql');
includes(migration, 'ADD COLUMN "contentConfiguration" JSONB', 'draft content column');
includes(migration, 'ADD COLUMN "publishedContentConfiguration" JSONB', 'published content column');
assert.doesNotMatch(migration, /UPDATE\s+"StoreExperienceProfile"/i, 'migration must not backfill or mutate existing rows');
assert.doesNotMatch(migration, /DROP\s+(COLUMN|TABLE)/i, 'migration must be additive only');

assert.doesNotMatch(service, /STORE_EXPERIENCE_NOT_EDITABLE[\s\S]*ยกเลิกเผยแพร่ก่อนแก้ไขแบบร่าง/, 'published storefront must remain editable as draft');
includes(service, 'publishedContentConfiguration', 'publish copies merchant content snapshot');
includes(repository, 'publishedSectionConfiguration', 'repository publishes section snapshot');
includes(repository, 'publishedVersion', 'repository increments published version');
includes(publicRepository, 'experience."publishedThemePreset"', 'public storefront selects published theme');
includes(publicRepository, 'experience."publishedSectionConfiguration"', 'public storefront selects published sections');
includes(publicRepository, 'experience."publishedContentConfiguration"', 'public storefront selects published merchant content');
includes(publicRepository, 'experience."publishedVersion" IS NOT NULL', 'public storefront requires a published snapshot');
includes(publicRepository, 'contentConfiguration: store.publishedContentConfiguration', 'public projection exposes published content only');
assert.doesNotMatch(publicRepository, /experience\."themePreset"/, 'public storefront must not select draft theme');
assert.doesNotMatch(publicRepository, /experience\."sectionConfiguration"/, 'public storefront must not select draft sections');
assert.doesNotMatch(publicRepository, /contentConfiguration:\s*store\.contentConfiguration/, 'public storefront must not project draft content');

console.log('store experience published snapshot foundation contract: PASS');
