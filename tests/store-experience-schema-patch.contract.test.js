import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(
  path.join(root, 'scripts/apply-store-experience-published-snapshot-schema.js'),
  'utf8'
);

const includes = (value, label) => assert.ok(script.includes(value), `${label} missing: ${value}`);

includes('StoreExperienceProfile model not found; schema was not modified', 'missing-model safety gate');
includes('StoreExperienceProfile anchor not found; schema was not modified', 'anchor safety gate');
includes('Partial published snapshot schema detected', 'partial-state safety gate');
includes('already applied', 'idempotent execution');
includes("'  contentConfiguration              Json?'", 'draft content field');
includes("'  publishedThemePreset", 'published theme field');
includes("'  publishedSectionConfiguration", 'published sections field');
includes("'  publishedContentConfiguration", 'published content field');
includes("'  publishedVersion", 'published version field');
includes("fs.writeFileSync(schemaPath, nextSource, 'utf8')", 'explicit schema write');

assert.doesNotMatch(script, /DROP|DELETE|TRUNCATE|UPDATE\s+"StoreExperienceProfile"/i, 'schema patch must not contain destructive SQL');
assert.doesNotMatch(script, /replaceAll\(/, 'schema patch must use a single guarded model replacement');

console.log('store experience schema patch contract: PASS');
