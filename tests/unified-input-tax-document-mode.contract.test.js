'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readPrismaSchemaSource } = require('../scripts/read-prisma-schema-source');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const schema = readPrismaSchemaSource(root);
const modeContract = read('src/modules/tax/inputDocuments/contracts/inputTaxDocumentModeContract.js');
const quickReceiptService = read('src/modules/product/quickStock/services/QuickReceiptSessionService.js');
const publisher = read('src/modules/product/quickStock/services/publishQuickReceiptTaxCandidateService.js');
const taxEntry = read('src/modules/tax/index.js');

assert.match(schema, /enum InputTaxDocumentMode[\s\S]*UNCLASSIFIED[\s\S]*NOT_RECEIVED[\s\S]*RECEIVED[\s\S]*NON_VAT_DOCUMENT[\s\S]*NO_INPUT_TAX_CLAIM/);
assert.match(schema, /model PurchaseOrderReceipt[\s\S]*taxDocumentMode\s+InputTaxDocumentMode\s+@default\(UNCLASSIFIED\)/);
assert.match(modeContract, /RECEIVED_WITH_GOODS: 'RECEIVED'/);
assert.match(quickReceiptService, /normalizeInputTaxDocumentMode/);
assert.match(publisher, /taxMode !== 'RECEIVED'/);
assert.match(taxEntry, /inputDocuments/);

console.log('Unified input tax document mode foundation contract: PASS');
