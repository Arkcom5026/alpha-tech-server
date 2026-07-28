'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const contract = read('src/modules/tax/inputDocuments/overview/inputTaxOverviewContract.js');
const repository = read('src/modules/tax/inputDocuments/overview/inputTaxOverviewRepository.js');
const service = read('src/modules/tax/inputDocuments/overview/inputTaxOverviewService.js');
const controller = read('src/modules/tax/inputDocuments/overview/inputTaxOverviewController.js');
const routes = read('src/modules/tax/inputDocuments/overview/inputTaxOverviewRoutes.js');
const taxRoutes = read('src/modules/tax/http/taxIntakeRoutes.js');
const taxEntry = read('src/modules/tax/index.js');

assert.match(contract, /INPUT_TAX_OVERVIEW_V1/);
assert.match(contract, /DOCUMENT/);
assert.match(contract, /CLAIM/);
assert.match(contract, /FILED/);
assert.match(contract, /claimableVatAmount/);
assert.match(contract, /blockedVatAmount/);
assert.match(contract, /filingReadiness/);
assert.match(contract, /recentDocuments/);

assert.match(repository, /FROM "TaxDocument" document/);
assert.match(repository, /InputTaxDocumentReceiptLink/);
assert.match(repository, /link\."state" = 'ACTIVE'/);
assert.match(repository, /COALESCE\(document\."issuedAt", document\."occurredAt"\)/);
assert.match(repository, /String\(value\)/);
assert.doesNotMatch(repository, /UPDATE|INSERT INTO|DELETE FROM/);
assert.doesNotMatch(repository, /FROM "PurchaseOrderReceipt"/);

assert.match(service, /allocationMismatchDocumentCount/);
assert.match(service, /missingSupplierTaxIdCount/);
assert.match(service, /NO_COMPARABLE_BASE/);
assert.match(service, /UNLINKED_DOCUMENT/);
assert.match(service, /ALLOCATION_MISMATCH/);
assert.match(service, /Only DOCUMENT period view is implemented in Increment 1/);
assert.match(service, /toFixed\(2\)/);

assert.match(controller, /OWNER/);
assert.match(controller, /MANAGER/);
assert.match(controller, /INPUT_TAX_OVERVIEW_BRANCH_FORBIDDEN/);
assert.match(routes, /router\.get\('\/'/);
assert.match(taxRoutes, /\/input-documents\/overview/);
assert.match(taxEntry, /inputTaxOverviewContract/);
assert.match(taxEntry, /getInputTaxOverview/);

console.log('Input Tax Overview V1 contract: PASS');
