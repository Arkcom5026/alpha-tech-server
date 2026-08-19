'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const workspace = read('src/modules/finance/combined-billing/documentWorkspaceService.js');

// Consolidation is intentionally CREDIT-only. Cash receipts/tax documents are immutable
// once issued; a companion/on-demand Delivery Note is presentation/fulfillment-only and
// must never become a source for a new consolidated financial/tax document.
assert.match(workspace, /where: \{ branchId, customerId: \{ in: group\.memberIds \}, isCredit: true, status: \{ not: 'CANCELLED' \} \}/);
assert.match(workspace, /tx\.sale\.findMany\(\{ where: \{ branchId, customerId: \{ in: group\.memberIds \}, isCredit: true, status: \{ not: 'CANCELLED' \}/);
assert.doesNotMatch(workspace, /isCashSaleFullyPaid/);
assert.doesNotMatch(workspace, /SALE_PAYMENT/);
assert.doesNotMatch(workspace, /DOCUMENT_WORKSPACE_CASH_SALE_NOT_PAID/);
assert.doesNotMatch(workspace, /DOCUMENT_WORKSPACE_CASH_PRICE_ADJUSTMENT_FORBIDDEN/);

// Inventory remains untouched by document consolidation.
assert.doesNotMatch(workspace, /stockMovement|stockItem\.update|simpleLot\.update|stockBalance\.update/);

console.log('Delivery Note credit-only consolidation authority contract: PASS');
