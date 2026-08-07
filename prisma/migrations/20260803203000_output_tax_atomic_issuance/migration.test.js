'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPrismaSchemaSource } = require('../../../scripts/read-prisma-schema-source');

const root = path.resolve(__dirname, '..', '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const migration = read('prisma/migrations/20260803203000_output_tax_atomic_issuance/migration.sql');
const schema = readPrismaSchemaSource(root);

assert.match(migration, /CREATE TYPE "TaxInvoiceKind"/);
assert.match(migration, /ADD COLUMN "issuerProfileId" INTEGER/);
assert.match(migration, /ADD COLUMN "issuerSnapshot" JSONB/);
assert.match(migration, /TaxDocument_issuerProfileId_fkey/);
assert.match(migration, /TaxDocument_issuer_kind_sequence_key/);
assert.match(migration, /TaxDocument_issuer_kind_number_key/);

assert.match(schema, /enum TaxInvoiceKind/);
assert.match(schema, /issuerProfileId\s+Int\?/);
assert.match(schema, /issuedDocumentNumber\s+String\?/);
assert.match(schema, /issuedSequence\s+Int\?/);
assert.match(schema, /issuerSnapshot\s+Json\?/);
assert.match(schema, /recipientSnapshot\s+Json\?/);
assert.match(schema, /TaxDocumentIssuerProfile/);

console.log('Output tax atomic issuance migration contract: PASS');
