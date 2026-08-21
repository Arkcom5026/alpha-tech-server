'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const policy = read('src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionNumberPolicy.js');
const service = read('src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionService.js');
const controller = read('src/modules/sales/documents/controllers/saleDeliveryNoteController.js');
const routes = read('src/modules/sales/routes/saleRoutes.js');

assert.match(policy, /deriveDeliveryNoteRevisionNumber/);
assert.match(policy, /return `\$\{root\}-R\$\{revision\}`/);
assert.match(service, /nextRevisionNumber = Number\(predecessor\.revisionNumber\) \+ 1/);
assert.match(service, /originalDocumentNumber: sale\.officialDocumentNumber/);
assert.match(service, /isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable/);
assert.match(controller, /createReturnAdjustedDeliveryNoteRevision/);
assert.match(controller, /employeeId: req\.user\?\.employeeId/);
assert.match(controller, /Numbering is server-owned/);
assert.doesNotMatch(controller, /req\.body.*documentNumber/);
assert.match(routes, /router\.post\('\/:id\/delivery-note\/revisions', allowSalesCore, createSaleDeliveryNoteRevision\)/);

const { deriveDeliveryNoteRevisionNumber } = require('../src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionNumberPolicy');
assert.equal(
  deriveDeliveryNoteRevisionNumber({ originalDocumentNumber: 'DN-SL-022608-0077', revisionNumber: 2 }),
  'DN-SL-022608-0077-R2',
);
assert.equal(
  deriveDeliveryNoteRevisionNumber({ originalDocumentNumber: 'DN-SL-022608-0077', revisionNumber: 3 }),
  'DN-SL-022608-0077-R3',
);

console.log('Delivery Note lifecycle Wave 2F revision HTTP/numbering contract: PASS');
