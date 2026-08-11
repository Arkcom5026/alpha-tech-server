'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sql = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');

test('input tax filing document id rebind is transactional and fail closed', () => {
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /LOCK TABLE "InputTaxFilingItem" IN ACCESS EXCLUSIVE MODE/);
  assert.match(sql, /INPUT_TAX_FILING_DOCUMENT_ID_REBIND_BLOCKED/);
  assert.match(sql, /BTRIM\(item\."taxDocumentId"::text\) !~ '\^\[1-9\]\[0-9\]\*\$'/);
  assert.match(sql, /document\."id"::text = BTRIM\(item\."taxDocumentId"::text\)/);
  assert.match(sql, /COMMIT;/m);
});

test('input tax filing document id rebind replaces the legacy FK with integer authority', () => {
  assert.match(sql, /DROP CONSTRAINT IF EXISTS "InputTaxFilingItem_taxDocumentId_fkey"/);
  assert.match(sql, /ALTER COLUMN "taxDocumentId" TYPE INTEGER/);
  assert.match(sql, /USING NULLIF\(BTRIM\("taxDocumentId"::text\), ''\)::INTEGER/);
  assert.match(sql, /ADD CONSTRAINT "InputTaxFilingItem_taxDocumentId_fkey"/);
  assert.match(sql, /FOREIGN KEY \("taxDocumentId"\) REFERENCES "TaxDocument"\("id"\)/);
});
