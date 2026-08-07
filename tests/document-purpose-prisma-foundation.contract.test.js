'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readPrismaSchemaSource } = require('../scripts/read-prisma-schema-source');

const root = path.resolve(__dirname, '..');
const schema = readPrismaSchemaSource(root);
const migrationRoot = path.join(root, 'prisma', 'migrations');
const migrationName = fs.readdirSync(migrationRoot)
  .filter((name) => name.endsWith('_document_purpose_registry_foundation'))
  .sort()
  .at(-1);
assert.ok(migrationName, 'Document Purpose migration must exist');
const sql = fs.readFileSync(path.join(migrationRoot, migrationName, 'migration.sql'), 'utf8');

for (const model of ['DocumentPurposeDefinition', 'DocumentPurposeVersion', 'DocumentPurposeEvent']) {
  assert.match(schema, new RegExp(`model ${model} \\{`));
}
assert.equal((schema.match(/^model\s+\w+\s*\{/gm) || []).length, 138);
assert.equal((schema.match(/^enum\s+\w+\s*\{/gm) || []).length, 114);
assert.doesNotMatch(schema, /^enum\s+DocumentPurpose\w*/m);
assert.match(schema, /branchId\s+Int[\s\S]*@@unique\(\[branchId, normalizedCode\]\)/);
assert.match(schema, /isSystem\s+Boolean/);
assert.match(schema, /lifecycleState\s+String/);
assert.match(schema, /currentVersion\s+Int/);
assert.match(schema, /@@unique\(\[definitionId, version\]\)/);
assert.match(schema, /snapshotHash\s+String/);
assert.match(schema, /eventType\s+String/);
assert.match(schema, /eventHash\s+String/);
assert.match(schema, /idempotencyKey\s+String\?/);
assert.match(schema, /documentPurposeDefinitions\s+DocumentPurposeDefinition\[\]/);
for (const relation of [
  'createdDocumentPurposeDefinitions', 'updatedDocumentPurposeDefinitions',
  'createdDocumentPurposeVersions', 'documentPurposeEvents',
]) assert.match(schema, new RegExp(`${relation}\\s+DocumentPurpose`));
assert.equal((schema.match(/onDelete:\s+Restrict/g) || []).filter(Boolean).length > 0, true);

assert.equal((sql.match(/CREATE TABLE/g) || []).length, 3);
assert.equal((sql.match(/ADD CONSTRAINT/g) || []).length, 8);
assert.equal((sql.match(/CREATE (?:UNIQUE )?INDEX/g) || []).length, 17);
assert.doesNotMatch(sql, /^\s*(?:DROP|RENAME|TRUNCATE|INSERT|UPDATE|DELETE)\b/im);
assert.doesNotMatch(sql, /CREATE TYPE[^;]*DocumentPurpose/i);
assert.doesNotMatch(sql, /ON DELETE CASCADE/i);

console.log('Document Purpose Prisma Foundation contract: PASS');
