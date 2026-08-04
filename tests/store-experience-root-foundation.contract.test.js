'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8');
const migration = fs.readFileSync(
  path.join(root, 'prisma', 'migrations', '20260804070000_store_experience_root_foundation', 'migration.sql'),
  'utf8',
);

assert.match(schema, /enum StoreExperienceProfileStatus/);
assert.match(schema, /model StoreExperienceProfile/);
assert.match(schema, /branchId\s+Int\s+@unique/);
assert.match(schema, /storeExperienceProfile\s+StoreExperienceProfile\?/);
assert.match(schema, /themeTokens\s+Json\?/);
assert.match(schema, /sectionConfiguration\s+Json\?/);

assert.match(migration, /CREATE TYPE "StoreExperienceProfileStatus"/);
assert.match(migration, /CREATE TABLE "StoreExperienceProfile"/);
assert.match(migration, /CREATE UNIQUE INDEX "StoreExperienceProfile_branchId_key"/);
assert.match(migration, /FOREIGN KEY \("branchId"\) REFERENCES "Branch"\("id"\)/);
assert.doesNotMatch(migration, /\b(UPDATE|DELETE|INSERT|TRUNCATE|DROP)\b/i);
assert.doesNotMatch(migration, /ALTER TABLE "Branch"\s+(?:DROP|ALTER)/i);

console.log('store experience root foundation contract: PASS');
