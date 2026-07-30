const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const schema = read('prisma/partner-store-application.prisma');
const migration = read('prisma/migrations/20260730030000_partner_store_application_foundation/migration.sql');

for (const value of ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN']) {
  assert.ok(schema.includes(value), `schema must define ${value}`);
  assert.ok(migration.includes(`'${value}'`), `migration must define ${value}`);
}

for (const field of [
  'applicationCode',
  'businessName',
  'contactName',
  'contactPhone',
  'status',
  'reviewNote',
  'createdAt',
  'updatedAt',
]) {
  assert.ok(schema.includes(field), `application schema must include ${field}`);
}

assert.ok(schema.includes('@@index([status, createdAt])'));
assert.ok(schema.includes('@@index([contactPhone, createdAt])'));
assert.ok(schema.includes('@@index([requestedStorefrontSlug])'));

assert.ok(migration.includes('CREATE TYPE "PartnerStoreApplicationStatus"'));
assert.ok(migration.includes('CREATE TABLE "PartnerStoreApplication"'));
assert.ok(!/\bDROP\b|\bTRUNCATE\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(migration));
assert.ok(!migration.includes('CREATE TABLE "Branch"'));
assert.ok(!migration.includes('ALTER TABLE "Branch"'));

console.log('partner store application foundation contract: PASS');
