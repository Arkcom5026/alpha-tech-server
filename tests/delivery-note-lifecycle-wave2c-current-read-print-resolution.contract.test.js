'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  mapPersistedRevisionLineToPrint,
} = require('../src/modules/sales/delivery-note/lifecycle/loadCurrentDeliveryNoteRevision');

const root = path.resolve(__dirname, '..');
const controller = fs.readFileSync(
  path.join(root, 'src/modules/sales/documents/controllers/saleDeliveryNoteController.js'),
  'utf8',
);
const resolver = fs.readFileSync(
  path.join(root, 'src/modules/sales/documents/print/projectCurrentSaleDeliveryNoteService.js'),
  'utf8',
);
const loader = fs.readFileSync(
  path.join(root, 'src/modules/sales/delivery-note/lifecycle/loadCurrentDeliveryNoteRevision.js'),
  'utf8',
);

const line = mapPersistedRevisionLineToPrint({
  id: 501,
  sourceLineType: 'SIMPLE',
  sourceLineId: 77,
  description: '32GB Micro SD Card SANDISK Ultra',
  originalQuantity: 3,
  returnedQuantity: 0,
  activeQuantity: 3,
  unitAmount: 390,
  originalAmount: 1170,
  returnedAmount: 0,
  activeAmount: 1170,
  snapshot: { sourceProductId: 88 },
});
assert.equal(line.quantity, 3);
assert.equal(line.lineAmount, 1170);
assert.equal(line.activeAmount, 1170);
assert.equal(line.sourceLineId, 77);

assert.match(loader, /currentKeyOf/);
assert.match(loader, /deliveryNoteDocument\.findUnique/);
assert.match(loader, /currentKey: key/);
assert.match(loader, /returnSources/);
assert.match(loader, /replacesDocument/);

assert.match(resolver, /source: 'LEGACY_SALE'/);
assert.match(resolver, /source: 'PERSISTED_REVISION'/);
assert.match(resolver, /canonicalReturnedAmount > revisionReturnedAmount/);
assert.match(resolver, /hasUnrevisedReturn \? 'ADJUSTED' : 'ACTIVE'/);
assert.match(resolver, /documentNumber: persistedRevision\.documentNumber/);
assert.match(resolver, /lines: persistedRevision\.lines/);
assert.match(resolver, /replacementProjection: null/);
assert.match(resolver, /currentRevisionNumber/);

assert.match(controller, /projectCurrentSaleDeliveryNote/);
assert.doesNotMatch(controller, /projectSaleDeliveryNote\(/);

console.log('Delivery Note lifecycle Wave 2C current read/print resolution contract: PASS');
