'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const repository = read('src/modules/finance/combined-billing/query/pending-customers/getCustomersWithPendingSalesRepository.js');
const workspace = read('src/modules/finance/combined-billing/documentWorkspaceService.js');

// Customer discovery for consolidation must remain CREDIT-only. Cash Delivery Notes
// created from an already-issued receipt/tax sale are printable companions only.
assert.match(repository, /branchId,\s*isCredit:\s*true,/);
assert.match(repository, /statusPayment:\s*\{\s*in:\s*\['PARTIALLY_PAID',\s*'PAID'\]\s*\}/);
assert.doesNotMatch(repository, /isCredit:\s*false/);

assert.match(workspace, /isCredit:\s*true/);
assert.doesNotMatch(workspace, /SALE_PAYMENT/);
assert.doesNotMatch(workspace, /isCashSaleFullyPaid/);

console.log('Delivery Note pending-customer credit-only discovery contract: PASS');
