'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  projectSaleRevisionState,
  buildOriginalMaterialization,
  buildReturnAdjustedRevision,
} = require('../src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionAuthority');

const root = path.resolve(__dirname, '..');
const service = fs.readFileSync(
  path.join(root, 'src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionService.js'),
  'utf8',
);

const sale = {
  id: 1046,
  branchId: 2,
  code: 'SL-022608-0077',
  officialDocumentNumber: 'DN-SL-022608-0077',
  soldAt: new Date('2026-08-19T00:00:00+07:00'),
  items: [
    { id: 11, price: 390, returnedQuantity: 0, documentDescription: 'SANDISK #1' },
    { id: 12, price: 390, returnedQuantity: 0, documentDescription: 'SANDISK #2' },
    { id: 13, price: 390, returnedQuantity: 0, documentDescription: 'SANDISK #3' },
  ],
  simpleItems: [
    { id: 21, quantity: 2, price: 640, returnedQuantity: 2, documentDescription: 'APACER' },
  ],
};

const state = projectSaleRevisionState(sale);
assert.equal(state.grossAmount, 1810);
assert.equal(state.returnedAmount, 640);
assert.equal(state.activeAmount, 1170);
assert.equal(state.originalLines.length, 4);
assert.equal(state.adjustedLines.length, 3);
assert.ok(state.adjustedLines.every((line) => line.description.startsWith('SANDISK')));

const original = buildOriginalMaterialization({ sale, createdById: 215 });
assert.equal(original.revisionNumber, 1);
assert.equal(original.revisionKind, 'ORIGINAL');
assert.equal(original.state, 'CURRENT');
assert.equal(original.grossAmount, 1810);
assert.equal(original.returnedAmount, 0);
assert.equal(original.activeAmount, 1810);
assert.equal(original.lines.length, 4);

const command = buildReturnAdjustedRevision({
  sale,
  predecessor: { id: 9001, revisionNumber: 1, documentNumber: original.documentNumber, state: 'CURRENT', activeAmount: 1810 },
  documentNumber: 'DN-SL-022608-0077-R2',
  createdById: 215,
  returnSources: [{ id: 7001, code: 'SR-TEST', status: 'COMPLETED', returnedAt: new Date('2026-08-21T05:02:40Z') }],
});
assert.equal(command.predecessorUpdate.state, 'SUPERSEDED');
assert.equal(command.predecessorUpdate.currentKey, null);
assert.equal(command.revision.revisionNumber, 2);
assert.equal(command.revision.revisionKind, 'RETURN_ADJUSTMENT');
assert.equal(command.revision.state, 'CURRENT');
assert.equal(command.revision.replacesDocumentId, 9001);
assert.equal(command.revision.grossAmount, 1810);
assert.equal(command.revision.returnedAmount, 640);
assert.equal(command.revision.activeAmount, 1170);
assert.equal(command.revision.lines.length, 3);
assert.equal(command.revision.returnSources.length, 1);

assert.throws(
  () => buildReturnAdjustedRevision({
    sale,
    predecessor: { id: 9001, revisionNumber: 1, documentNumber: original.documentNumber, state: 'CURRENT', activeAmount: 1170 },
    documentNumber: 'DN-SL-022608-0077-R2',
    createdById: 215,
    returnSources: [{ id: 7001, status: 'COMPLETED', returnedAt: new Date() }],
  }),
  (error) => error?.code === 'DELIVERY_NOTE_REVISION_NO_CHANGE',
);

const allReturnedSale = {
  ...sale,
  items: sale.items.map((item) => ({ ...item, returnedQuantity: 1 })),
};
assert.throws(
  () => buildReturnAdjustedRevision({
    sale: allReturnedSale,
    predecessor: { id: 9001, revisionNumber: 1, documentNumber: original.documentNumber, state: 'CURRENT', activeAmount: 1810 },
    documentNumber: 'DN-SL-022608-0077-R2',
    createdById: 215,
    returnSources: [{ id: 7001, status: 'COMPLETED', returnedAt: new Date() }],
  }),
  (error) => error?.code === 'DELIVERY_NOTE_REVISION_EMPTY',
);

assert.match(service, /TransactionIsolationLevel\.Serializable/);
assert.match(service, /ensureOriginalMaterialized/);
assert.match(service, /findIssuedTaxAuthority/);
assert.match(service, /DELIVERY_NOTE_REVISION_SOURCE_CONSOLIDATED/);
assert.match(service, /DELIVERY_NOTE_REVISION_TAX_ALREADY_ISSUED/);
assert.match(service, /status:\s*'COMPLETED'/);
assert.match(service, /deliveryNoteDocument\.update/);
assert.match(service, /createDocumentFromAuthority/);
assert.doesNotMatch(service, /stockMovement|stockItem\.update|sale\.update|payment\.create|taxDocument\.create/);

console.log('Delivery Note lifecycle Wave 2B materialization/revision authority contract: PASS');
