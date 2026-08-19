'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const service = read('src/modules/sales/documents/issue/issueSaleDeliveryNoteService.js');
const controller = read('src/modules/sales/documents/controllers/saleDeliveryNoteController.js');
const routes = read('src/modules/sales/routes/saleRoutes.js');

assert.match(service, /where: \{ id: normalizedSaleId, branchId: normalizedBranchId \}/);
assert.match(service, /sale\.status === 'CANCELLED'/);
assert.match(service, /if \(sale\.officialDocumentNumber\)/);
assert.match(service, /replayed: true/);
assert.match(service, /const documentNumber = `DN-\$\{sale\.code\}`/);
assert.match(service, /officialDocumentNumber: null/);
assert.match(service, /data: \{ officialDocumentNumber: documentNumber \}/);
assert.match(service, /consolidatedDeliveryLine\.findFirst/);
assert.match(service, /DELIVERY_NOTE_ALREADY_CONSOLIDATED/);
assert.doesNotMatch(service, /stockMovement|stockItem\.update|payment\.create|taxCandidate|taxDocument/);

assert.match(controller, /issueSaleDeliveryNote/);
assert.match(controller, /issueSaleDeliveryNoteController/);
assert.match(controller, /result\.replayed \? 200 : 201/);
assert.match(routes, /router\.post\('\/:id\/delivery-note', issueSaleDeliveryNoteController\)/);
assert.match(routes, /router\.get\('\/:id\/delivery-note', getSaleDeliveryNote\)/);

console.log('Sale delivery-note on-demand issuance contract: PASS');
