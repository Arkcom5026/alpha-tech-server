'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('legacy migration explains why InputTaxFilingItem taxDocumentId remains text-compatible', () => {
  const legacyMigration = read('prisma/migrations/20260726_add_service_asset_foundation/migration.sql');
  const documentCentricMigration = read('prisma/migrations/20260729103000_add_tax_document_centric_input_tax_filing/migration.sql');
  assert.match(legacyMigration, /"InputTaxFilingItem"[\s\S]*"taxDocumentId" TEXT/);
  assert.match(documentCentricMigration, /ADD COLUMN IF NOT EXISTS "taxDocumentId" INTEGER/);
});

test('overview compares legacy filing text ids to current integer TaxDocument ids explicitly', () => {
  const source = read('src/modules/tax/inputDocuments/overview/inputTaxOverviewRepository.js');
  assert.match(source, /item\."taxDocumentId" = document\."id"::text/);
  assert.doesNotMatch(source, /item\."taxDocumentId" = document\."id"\s/);
});

test('filing repository writes and queries current document ids through text compatibility key', () => {
  const source = read('src/modules/tax/inputDocuments/filing/inputTaxFilingRepository.js');
  assert.match(source, /const filingTaxDocumentKey = \(value\) => String\(Number\(value\)\)/);
  assert.match(source, /"taxDocumentId" = \$\{filingTaxDocumentKey\(taxDocumentId\)\}/);
  assert.match(source, /\$\{filingTaxDocumentKey\(taxDocumentId\)\},/);
});

test('filing repository explicitly casts claimed amounts to numeric for raw SQL writes', () => {
  const source = read('src/modules/tax/inputDocuments/filing/inputTaxFilingRepository.js');
  assert.match(source, /const filingNumericAmount = \(value\) => String\(value \?\? 0\)/);
  assert.match(source, /\$\{filingNumericAmount\(claimedSubtotalAmount\)\}::numeric/);
  assert.match(source, /\$\{filingNumericAmount\(claimedVatAmount\)\}::numeric/);
  assert.match(source, /\$\{filingNumericAmount\(claimedTotalAmount\)\}::numeric/);
  assert.doesNotMatch(source, /\n\s+\$\{claimedSubtotalAmount\},/);
});

test('tax period input filing completeness guard bridges legacy text ids without mutating data', () => {
  const source = read('src/modules/tax/periods/taxPeriodService.js');
  assert.match(source, /item\."taxDocumentId" = record\."taxDocumentId"::text/);
});
