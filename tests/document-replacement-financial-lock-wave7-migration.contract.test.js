'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(
  path.join(root, 'prisma/migrations/20260820082500_document_replacement_financial_lock_wave1/migration.sql'),
  'utf8',
);

assert.match(migration, /CREATE TABLE "SaleDocumentReplacement"/);
assert.match(migration, /CREATE TABLE "SaleDocumentReplacementLine"/);
assert.match(migration, /"financialLock" JSONB NOT NULL/);
assert.match(migration, /"finalSnapshot" JSONB/);
assert.match(migration, /"draftKey" TEXT/);
assert.match(migration, /"currentKey" TEXT/);
assert.match(migration, /SaleDocumentReplacement_draftKey_key/);
assert.match(migration, /SaleDocumentReplacement_currentKey_key/);
assert.match(migration, /SaleDocumentReplacement_preparation_number_key/);
assert.match(migration, /SaleDocumentReplacement_replacesReplacementId_fkey/);
assert.match(migration, /SaleDocumentReplacementLine_replacementId_fkey/);

// Wave 7 migration remains additive: no mutation of sale/stock/tax authority tables.
assert.doesNotMatch(migration, /ALTER TABLE "Sale"/);
assert.doesNotMatch(migration, /ALTER TABLE "SaleItem"/);
assert.doesNotMatch(migration, /ALTER TABLE "StockItem"/);
assert.doesNotMatch(migration, /ALTER TABLE "TaxDocument"/);
assert.doesNotMatch(migration, /ALTER TABLE "OutputVatRecord"/);
assert.doesNotMatch(migration, /DROP TABLE/);
assert.doesNotMatch(migration, /DROP COLUMN/);

console.log('Document replacement financial lock Wave 7 migration contract: PASS');
