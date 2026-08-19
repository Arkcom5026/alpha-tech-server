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

// Wave 1 keeps existing consolidation selection semantics while issuance/history
// authority is repaired. Cash companion consolidation is widened separately only
// after paid-line readiness is reconciled with the credit settlement authority.
assert.match(workspace, /where: \{ branchId, customerId, isCredit: true/);

// The completion service keeps the existing single sale stock movement authority.
assert.strictEqual((completion.match(/stockMovement\.createMany/g) || []).length, 1);

console.log('Cash-sale companion delivery-note contract: PASS');
