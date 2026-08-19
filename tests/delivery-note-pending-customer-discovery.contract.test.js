'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const repository = read('src/modules/finance/combined-billing/query/pending-customers/getCustomersWithPendingSalesRepository.js');
const workspace = read('src/modules/finance/combined-billing/documentWorkspaceService.js');

assert.match(repository, /officialDocumentNumber:\s*\{\s*not:\s*null\s*\}/);
assert.match(repository, /customerId:\s*\{\s*not:\s*null\s*\}/);
assert.match(repository, /isCredit:\s*true[\s\S]*statusPayment:\s*\{\s*in:\s*\['PARTIALLY_PAID',\s*'PAID'\]\s*\}/);
assert.match(repository, /isCredit:\s*false[\s\S]*statusPayment:\s*'PAID'/);
assert.doesNotMatch(repository, /branchId,\s*isCredit:\s*true,\s*status:/);

assert.match(workspace, /officialDocumentNumber:\s*\{\s*not:\s*null\s*\}/);
assert.match(workspace, /isCashSaleFullyPaid/);
assert.match(workspace, /paymentAuthority:\s*sale\.isCredit\s*\?\s*'DELIVERY_CREDIT_SETTLEMENT'\s*:\s*'SALE_PAYMENT'/);

console.log('Delivery Note pending-customer discovery contract: PASS');
