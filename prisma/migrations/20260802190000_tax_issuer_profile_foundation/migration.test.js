'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..', '..');
const { readPrismaSchemaSource } = require(path.join(root, 'scripts/read-prisma-schema-source'));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const migration = read('prisma/migrations/20260802190000_tax_issuer_profile_foundation/migration.sql');
const schema = readPrismaSchemaSource(root);

assert.match(migration, /CREATE TYPE "TaxIssuerProfileStatus"/);
assert.match(migration, /CREATE TABLE "TaxIssuerProfile"/);
assert.match(migration, /"branchId" INTEGER NOT NULL/);
assert.match(migration, /FOREIGN KEY \("branchId"\) REFERENCES "Branch"\("id"\)\s+ON DELETE RESTRICT/);
assert.match(migration, /CREATE UNIQUE INDEX "TaxIssuerProfile_branchId_key"/);
assert.match(migration, /nextShortTaxInvoiceNumber_positive/);
assert.match(migration, /nextFullTaxInvoiceNumber_positive/);

assert.match(schema, /taxIssuerProfile\s+TaxIssuerProfile\?/);
assert.match(schema, /model TaxIssuerProfile \{/);
assert.match(schema, /branchId\s+Int\s+@unique/);
assert.match(schema, /status\s+TaxIssuerProfileStatus\s+@default\(DRAFT\)/);
assert.match(schema, /nextShortTaxInvoiceNumber\s+Int\s+@default\(1\)/);
assert.match(schema, /nextFullTaxInvoiceNumber\s+Int\s+@default\(1\)/);
assert.match(schema, /onDelete: Restrict/);

console.log('Tax issuer profile migration contract: PASS');
