'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const rebindMigrationPath = 'prisma/migrations/20260811181500_input_tax_filing_document_id_rebind/migration.sql';

test('migration history explains the legacy text drift and current integer rebind', () => {
  const legacyMigration = read('prisma/migrations/20260726_add_service_asset_foundation/migration.sql');
  const documentCentricMigration = read('prisma/migrations/20260729103000_add_tax_document_centric_input_tax_filing/migration.sql');
  const rebindMigration = read(rebindMigrationPath);
  assert.match(legacyMigration, /"InputTaxFilingItem"[\s\S]*"taxDocumentId" TEXT/);
  assert.match(documentCentricMigration, /ADD COLUMN IF NOT EXISTS "taxDocumentId" INTEGER/);
  assert.match(rebindMigration, /ALTER COLUMN "taxDocumentId" TYPE INTEGER/);
  assert.match(rebindMigration, /INPUT_TAX_FILING_DOCUMENT_ID_REBIND_BLOCKED/);
  assert.match(rebindMigration, /FOREIGN KEY \("taxDocumentId"\) REFERENCES "TaxDocument"\("id"\)/);
});

test('overview joins filing items to current TaxDocument integer ids directly', () => {
  const source = read('src/modules/tax/inputDocuments/overview/inputTaxOverviewRepository.js');
  assert.match(source, /item\."taxDocumentId" = document\."id"/);
  assert.doesNotMatch(source, /item\."taxDocumentId" = document\."id"::text/);
});

test('filing repository writes and queries current document ids as integers', () => {
  const source = read('src/modules/tax/inputDocuments/filing/inputTaxFilingRepository.js');
  assert.match(source, /const filingTaxDocumentKey = \(value\) => Number\(value\)/);
  assert.match(source, /"taxDocumentId" = \$\{filingTaxDocumentKey\(taxDocumentId\)\}/);
  assert.match(source, /\$\{filingTaxDocumentKey\(taxDocumentId\)\},/);
  assert.doesNotMatch(source, /String\(Number\(value\)\)/);
});

test('filing repository explicitly casts claimed amounts to numeric for raw SQL writes', () => {
  const source = read('src/modules/tax/inputDocuments/filing/inputTaxFilingRepository.js');
  assert.match(source, /const filingNumericAmount = \(value\) => String\(value \?\? 0\)/);
  assert.match(source, /\$\{filingNumericAmount\(claimedSubtotalAmount\)\}::numeric/);
  assert.match(source, /\$\{filingNumericAmount\(claimedVatAmount\)\}::numeric/);
  assert.match(source, /\$\{filingNumericAmount\(claimedTotalAmount\)\}::numeric/);
  assert.doesNotMatch(source, /\n\s+\$\{claimedSubtotalAmount\},/);
});

test('tax period input filing completeness guard uses current integer document ids', () => {
  const source = read('src/modules/tax/periods/taxPeriodService.js');
  assert.match(source, /item\."taxDocumentId" = record\."taxDocumentId"/);
  assert.doesNotMatch(source, /item\."taxDocumentId" = record\."taxDocumentId"::text/);
});
