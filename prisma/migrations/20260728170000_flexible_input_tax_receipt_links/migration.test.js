'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');

assert.match(sql, /InputTaxReceiptSourceType.+PO_RECEIPT.+QUICK_RECEIPT/s);
assert.match(sql, /CREATE TABLE "InputTaxDocumentReceiptLink"/);
assert.match(sql, /CREATE TABLE "InputTaxDocumentReceiptLinkEvent"/);
assert.match(sql, /ADD COLUMN "deliveryNoteNumber" TEXT/);
assert.match(sql, /ADD COLUMN "deliveryNoteDate" TIMESTAMP\(3\)/);
assert.match(sql, /active_document_source_key/);
assert.match(sql, /WHERE "state" = 'ACTIVE'/);
assert.match(sql, /allocation_nonnegative/);
assert.match(sql, /cancelled_shape/);
assert.doesNotMatch(sql, /ON DELETE CASCADE/);

console.log('Flexible input-tax receipt link migration contract: PASS');
