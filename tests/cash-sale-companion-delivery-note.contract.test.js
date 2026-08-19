'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const completion = read('src/modules/sales/completion/services/saleCompletionService.js');
const legacyCreate = read('src/modules/sales/create/controllers/saleLegacyCreateController.js');
const printable = read('src/modules/sales/documents/print/projectSaleDeliveryNoteService.js');
const history = read('src/modules/sales/history/controllers/saleHistoryController.js');
const workspace = read('src/modules/finance/combined-billing/documentWorkspaceService.js');

assert.match(
  completion,
  /officialDocumentNumber: command\.sale\.deliveryNoteMode === 'PRINT' \? `DN-\$\{code\}` : null/,
);
assert.match(legacyCreate, /isCreditSale \|\| String\(deliveryNoteMode \|\| ''\)\.toUpperCase\(\) === 'PRINT'/);
assert.match(printable, /!sale\.officialDocumentNumber/);
assert.match(printable, /sale\.status === 'CANCELLED'/);
assert.match(history, /onlyWithDeliveryNote/);
assert.match(history, /officialDocumentNumber: \{ not: null \}/);

// Any issued Delivery Note may enter workspace discovery. Credit readiness keeps
// settlement-line authority; CASH readiness is derived from the canonical Sale
// payment projection and never fabricates customer-credit settlement rows.
assert.doesNotMatch(workspace, /customerId: \{ in: group\.memberIds \}, isCredit: true/);
assert.match(workspace, /officialDocumentNumber: \{ not: null \}/);
assert.match(workspace, /isCashSaleFullyPaid/);
assert.match(workspace, /statusPayment/);
assert.match(workspace, /paidAmount/);
assert.match(workspace, /paymentAuthority: sale\.isCredit \? 'DELIVERY_CREDIT_SETTLEMENT' : 'SALE_PAYMENT'/);
assert.match(workspace, /DOCUMENT_WORKSPACE_CASH_SALE_NOT_PAID/);
assert.match(workspace, /DOCUMENT_WORKSPACE_CASH_PRICE_ADJUSTMENT_FORBIDDEN/);

// The completion service keeps the existing single sale stock movement authority.
assert.strictEqual((completion.match(/stockMovement\.createMany/g) || []).length, 1);

console.log('Cash-sale companion delivery-note contract: PASS');
