'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const service = read('src/modules/sales/documents/print/projectSaleDeliveryNoteService.js');
const controller = read('src/modules/sales/documents/controllers/saleDeliveryNoteController.js');
const routes = read('src/modules/sales/routes/saleRoutes.js');

assert.match(service, /where: \{ id: normalizedSaleId, branchId: normalizedBranchId \}/);
assert.match(service, /sale\.status !== 'COMPLETED'/);
assert.match(service, /sale\.isCredit === true \|\| sale\.paid !== true \|\| sale\.statusPayment !== 'PAID'/);
assert.match(service, /DELIVERY_NOTE_NOT_REQUIRED/);
assert.match(service, /DELIVERY_NOTE/);
assert.match(service, /ใบส่งสินค้า/);
assert.match(service, /simpleItems/);
assert.match(service, /documentDescription/);
assert.match(controller, /req\.user\?\.branchId/);
assert.match(controller, /projectSaleDeliveryNote/);
assert.match(routes, /getSaleDeliveryNote/);
assert.match(routes, /\/:id\/delivery-note/);

console.log('Sale delivery-note print projection contract: PASS');
