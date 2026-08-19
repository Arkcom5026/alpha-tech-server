'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const controller = read('src/modules/procurement/purchase-order/presentation/getPurchaseOrderPresentationController.js');
const routes = read('src/modules/procurement/purchase-order/routes/purchaseOrderRoutes.js');

assert.match(routes, /router\.get\('\/:id\/presentation', getPurchaseOrderPresentation\)/);
assert.match(controller, /const branchId = positiveInt\(req\.user\?\.branchId\)/);
assert.match(controller, /where:\s*\{ id: purchaseOrderId, branchId \}/);
assert.match(controller, /documentHeaderConfig:\s*true/);
assert.match(controller, /getOrCreatePresentationSnapshot/);
assert.match(controller, /sourceType:\s*'PURCHASE_ORDER'/);
assert.match(controller, /documentPurpose:\s*'PURCHASE_ORDER'/);
assert.match(controller, /rendererFamily:\s*'A4'/);
assert.match(controller, /issuedAt:\s*purchaseOrder\.date \|\| purchaseOrder\.createdAt/);
assert.match(controller, /presentationSnapshot:\s*record\.snapshot/);

console.log('purchase-order-document-presentation-wave3.contract.test.js: PASS');
