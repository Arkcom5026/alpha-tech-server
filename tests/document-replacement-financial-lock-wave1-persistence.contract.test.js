'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const prismaFile = fs.readFileSync(
  path.join(root, 'prisma/commerce/sale-document-preparation.prisma'),
  'utf8',
);
const migrationFile = fs.readFileSync(
  path.join(root, 'prisma/migrations/20260820082500_document_replacement_financial_lock_wave1/migration.sql'),
  'utf8',
);

assert.match(prismaFile, /model SaleDocumentReplacement \{/);
assert.match(prismaFile, /model SaleDocumentReplacementLine \{/);
assert.match(prismaFile, /replacementNumber\s+Int/);
assert.match(prismaFile, /replacesReplacementId\s+Int\?/);
assert.match(prismaFile, /status\s+String\s+@default\("DRAFT"\)/);
assert.match(prismaFile, /draftKey\s+String\?\s+@unique/);
assert.match(prismaFile, /currentKey\s+String\?\s+@unique/);
assert.match(prismaFile, /reason\s+String/);
assert.match(prismaFile, /financialLock\s+Json/);
assert.match(prismaFile, /finalSnapshot\s+Json\?/);
assert.match(prismaFile, /@@unique\(\[preparationId, replacementNumber\]/);
assert.match(prismaFile, /portion\s+String/);
assert.match(prismaFile, /lineType\s+String/);

assert.match(migrationFile, /CREATE TABLE "SaleDocumentReplacement"/);
assert.match(migrationFile, /CREATE TABLE "SaleDocumentReplacementLine"/);
assert.match(migrationFile, /"financialLock" JSONB NOT NULL/);
assert.match(migrationFile, /"finalSnapshot" JSONB/);
assert.match(migrationFile, /"draftKey" TEXT/);
assert.match(migrationFile, /"currentKey" TEXT/);
assert.match(migrationFile, /SaleDocumentReplacement_draftKey_key/);
assert.match(migrationFile, /SaleDocumentReplacement_currentKey_key/);
assert.match(migrationFile, /SaleDocumentReplacement_preparation_number_key/);
assert.match(migrationFile, /REFERENCES "SaleDocumentPreparation"\("id"\)/);
assert.match(migrationFile, /REFERENCES "SaleDocumentReplacement"\("id"\)/);
assert.match(migrationFile, /ON DELETE RESTRICT ON UPDATE CASCADE/);
assert.match(migrationFile, /SaleDocumentReplacementLine_replacementId_fkey/);
assert.match(migrationFile, /ON DELETE CASCADE ON UPDATE CASCADE/);

const replacementBlock = prismaFile.match(/model SaleDocumentReplacement \{([\s\S]*?)\n\}/)?.[1] || '';
const lineBlock = prismaFile.match(/model SaleDocumentReplacementLine \{([\s\S]*?)\n\}/)?.[1] || '';

for (const forbidden of [
  'productId',
  'stockItemId',
  'simpleLotId',
  'saleItemId',
  'saleItemSimpleId',
  'stockMovementId',
  'paymentId',
  'customerMoney',
]) {
  assert.ok(!replacementBlock.includes(forbidden), `replacement aggregate must not persist ${forbidden}`);
  assert.ok(!lineBlock.includes(forbidden), `replacement lines must not persist ${forbidden}`);
}

assert.ok(
  !migrationFile.includes('ALTER TABLE "Sale"'),
  'Wave 1 must not alter Sale truth',
);
assert.ok(
  !migrationFile.includes('ALTER TABLE "StockItem"'),
  'Wave 1 must not alter Stock authority',
);
assert.ok(
  !migrationFile.includes('ALTER TABLE "TaxDocument"'),
  'Wave 1 must not mutate TaxDocument authority',
);
assert.ok(
  !migrationFile.includes('ALTER TABLE "OutputVatRecord"'),
  'Wave 1 must not mutate Output VAT authority',
);

console.log('Document replacement financial lock Wave 1 persistence contract: PASS');
