'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readPrismaSchemaSource } = require('../scripts/read-prisma-schema-source');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const schema = readPrismaSchemaSource(root);
const migration = read('prisma/migrations/20260730180000_product_reservation_lifecycle_persistence_authority/migration.sql');

for (const token of [
  'stockReleasedAt     DateTime?',
  'version             Int',
  'model ProductReservationLifecycleCommand',
  'model ProductReservationLifecycleEvent',
  'enum ProductReservationLifecycleCommandType',
  '@@unique([reservationId, commandKey])',
  'commandId     Int                @unique',
  'lifecycleCommands',
  'lifecycleEvents',
]) {
  assert.ok(schema.includes(token), `Missing Prisma lifecycle authority: ${token}`);
}

for (const token of [
  'ADD COLUMN "stockReleasedAt"',
  'ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1',
  'CREATE TABLE "ProductReservationLifecycleCommand"',
  'CREATE TABLE "ProductReservationLifecycleEvent"',
  'UNIQUE ("reservationId", "commandKey")',
  'UNIQUE ("commandId")',
  'ProductReservationLifecycleEvent_commandId_fkey',
]) {
  assert.ok(migration.includes(token), `Missing additive migration authority: ${token}`);
}

assert.doesNotMatch(migration, /DROP\s+TABLE/i);
assert.doesNotMatch(migration, /CREATE\s+TABLE\s+"ProductReservation"\s*\(/i);
assert.doesNotMatch(migration, /DELETE\s+FROM|UPDATE\s+"(?:Product|Customer|Branch|Stock)/i);

console.log('ProductReservation lifecycle persistence authority contract: PASS');
