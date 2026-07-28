'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');

assert.match(sql, /CREATE TYPE "InputTaxDocumentMode"/);
for (const mode of ['UNCLASSIFIED', 'NOT_RECEIVED', 'RECEIVED', 'NON_VAT_DOCUMENT', 'NO_INPUT_TAX_CLAIM']) {
  assert.match(sql, new RegExp(`'${mode}'`));
}
assert.match(sql, /ALTER TABLE "PurchaseOrderReceipt"/);
assert.match(sql, /ALTER TABLE "QuickReceiptSession"/);
assert.match(sql, /supplierTaxInvoiceNumber/);
assert.match(sql, /supplierTaxInvoiceDate/);
assert.match(sql, /THEN 'RECEIVED'/);
assert.match(sql, /ELSE 'UNCLASSIFIED'/);
assert.doesNotMatch(sql, /ELSE 'NOT_RECEIVED'/);
assert.match(sql, /taxDocumentReceiptSource" = 'WITH_GOODS'/);
assert.match(sql, /PurchaseOrderReceipt_branch_tax_mode_received_idx/);
assert.match(sql, /QuickReceiptSession_branch_tax_mode_completed_idx/);

console.log('Unified input tax document mode migration contract: PASS');
