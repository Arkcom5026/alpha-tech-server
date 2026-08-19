'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const workspace = read('src/modules/finance/combined-billing/documentWorkspaceService.js');
const pending = read('src/modules/finance/combined-billing/query/pending-customers/getCustomersWithPendingSalesRepository.js');
const issue = read('src/modules/sales/documents/issue/issueSaleDeliveryNoteService.js');

// Cash companion/on-demand Delivery Notes remain printable but never enter consolidation.
assert.match(issue, /officialDocumentNumber/);
assert.match(workspace, /isCredit: true/);
assert.match(pending, /isCredit: true/);
assert.doesNotMatch(pending, /isCredit: false/);
assert.doesNotMatch(workspace, /SALE_PAYMENT/);
assert.doesNotMatch(workspace, /isCashSaleFullyPaid/);

console.log('Delivery Note credit-only consolidation authority contract: PASS');
