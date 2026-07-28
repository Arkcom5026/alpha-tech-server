'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const repository = read('src/modules/tax/inputDocuments/links/inputTaxReceiptLinkRepository.js');
const service = read('src/modules/tax/inputDocuments/links/inputTaxReceiptLinkService.js');
const controller = read('src/modules/tax/inputDocuments/links/inputTaxReceiptLinkController.js');
const routes = read('src/modules/tax/inputDocuments/links/inputTaxReceiptLinkRoutes.js');
const taxRoutes = read('src/modules/tax/http/taxIntakeRoutes.js');
const taxEntry = read('src/modules/tax/index.js');

assert.match(service, /prisma\.\$transaction/);
assert.match(service, /PO_RECEIPT/);
assert.match(service, /QUICK_RECEIPT/);
assert.match(service, /INPUT_TAX_LINK_SUPPLIER_MISMATCH/);
assert.match(service, /INPUT_TAX_LINK_ALLOCATION_EXCEEDED/);
assert.match(service, /INPUT_TAX_LINK_ALREADY_ACTIVE/);
assert.match(service, /INPUT_TAX_LINK_PERIOD_LOCKED/);
assert.match(service, /INPUT_TAX_LINK_DOCUMENT_LOCKED/);
assert.match(service, /'DRAFT',[\s\S]*'REGISTERED',[\s\S]*'UNDER_REVIEW',[\s\S]*'REJECTED'/);
assert.doesNotMatch(service, /VALIDATED|ISSUED/);
assert.match(service, /commandKey is required/);
assert.match(repository, /FOR UPDATE OF document/);
assert.match(repository, /supplier_identity/);
assert.match(repository, /REGEXP_REPLACE/);
assert.match(repository, /FOR UPDATE OF receipt/);
assert.match(repository, /InputTaxDocumentReceiptLinkEvent/);
assert.match(repository, /state" = 'CANCELLED'/);
assert.doesNotMatch(repository, /DELETE FROM "InputTaxDocumentReceiptLink"/);
assert.match(routes, /router\.post\('\/'/);
assert.match(routes, /router\.patch\('\/:linkId'/);
assert.match(routes, /router\.post\('\/:linkId\/cancel'/);
assert.match(taxRoutes, /documents\/:taxDocumentId\/receipt-links/);
assert.match(controller, /receiptReferences/);
assert.match(controller, /INPUT_TAX_LINK_ACCESS_FORBIDDEN/);
assert.match(controller, /INPUT_TAX_LINK_BRANCH_FORBIDDEN/);
assert.match(taxEntry, /receiptLinks/);

console.log('Flexible input-tax receipt link command contract: PASS');
