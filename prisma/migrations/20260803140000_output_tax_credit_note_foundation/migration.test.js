'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname);
const sql = fs.readFileSync(path.join(root, 'migration.sql'), 'utf8');

assert.match(sql, /ADD COLUMN "creditNotePrefix" TEXT/);
assert.match(sql, /ADD COLUMN "nextCreditNoteNumber" INTEGER NOT NULL DEFAULT 1/);
assert.match(sql, /ADD COLUMN "originalTaxDocumentId" INTEGER/);
assert.match(sql, /ADD COLUMN "saleReturnId" INTEGER/);
assert.match(sql, /TaxDocument_originalTaxDocumentId_key/);
assert.match(sql, /TaxDocument_saleReturnId_key/);
assert.match(sql, /REFERENCES "TaxDocument"\("id"\)/);
assert.match(sql, /REFERENCES "SaleReturn"\("id"\)/);
assert.doesNotMatch(sql, /DELETE FROM "TaxDocument"/i);
assert.doesNotMatch(sql, /UPDATE "TaxDocument"\s+SET\s+"status"/i);

console.log('Output tax credit-note persistence migration contract: PASS');
