'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  projectWorkspaceWriteSource,
  assertWorkspaceWriteSelection,
} = require('../src/modules/finance/combined-billing/documentWorkspaceWriteAuthority');

const root = path.resolve(__dirname, '..');
const service = fs.readFileSync(
  path.join(root, 'src/modules/finance/combined-billing/documentWorkspaceService.js'),
  'utf8',
);

const sale = {
  id: 1046,
  code: 'SL-022608-0077',
  officialDocumentNumber: 'DN-SL-022608-0077',
  soldAt: new Date('2026-08-19T00:00:00+07:00'),
};

const active = projectWorkspaceWriteSource({
  sale,
  type: 'STOCK',
  item: {
    id: 10,
    price: 1170,
    returnedQuantity: 0,
    documentDescription: '32GB Micro SD Card SANDISK Ultra',
  },
});
assert.equal(active.quantity, 1);
assert.equal(active.sourceAmount, 1170);

assert.throws(
  () => projectWorkspaceWriteSource({
    sale,
    type: 'SIMPLE',
    item: {
      id: 20,
      quantity: 2,
      price: 640,
      returnedQuantity: 2,
      documentDescription: '32GB Micro SD Card APACER',
    },
  }),
  (error) => error?.code === 'DOCUMENT_WORKSPACE_SOURCE_RETURNED',
);

const partial = projectWorkspaceWriteSource({
  sale,
  type: 'SIMPLE',
  item: {
    id: 21,
    quantity: 2,
    price: 640,
    returnedQuantity: 1,
    documentDescription: 'Partial return fixture',
  },
});
assert.equal(partial.originalQuantity, 2);
assert.equal(partial.returnedQuantity, 1);
assert.equal(partial.activeQuantity, 1);
assert.equal(partial.quantity, 1);
assert.equal(partial.sourceAmount, 320);

const selection = assertWorkspaceWriteSelection({
  projection: partial,
  documentUnitPrice: 320,
});
assert.equal(selection.quantity, 1);
assert.equal(selection.sourceAmount, 320);
assert.equal(selection.documentAmount, 320);

assert.match(service, /projectWorkspaceWriteSource/);
assert.match(service, /assertWorkspaceWriteSelection/);
assert.match(service, /DOCUMENT_WORKSPACE_SOURCE_RETURNED/);
assert.match(service, /quantity: authority\.quantity/);
assert.match(service, /sourceAmount: authority\.sourceAmount/);
assert.doesNotMatch(service, /stockMovement|inventory|stockItem\.update|sale\.update/);

console.log('Delivery Note lifecycle Wave 1F Document Workspace write guard contract: PASS');
