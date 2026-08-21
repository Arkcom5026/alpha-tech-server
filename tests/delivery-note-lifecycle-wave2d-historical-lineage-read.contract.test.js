'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  mapRevisionSummary,
} = require('../src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionHistoryService');

const root = path.resolve(__dirname, '..');
const routes = fs.readFileSync(path.join(root, 'src/modules/sales/routes/saleRoutes.js'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'src/modules/sales/documents/controllers/saleDeliveryNoteController.js'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionHistoryService.js'), 'utf8');

const revision1 = mapRevisionSummary({
  id: 1,
  branchId: 2,
  saleId: 1046,
  documentNumber: 'DN-SL-022608-0077',
  revisionNumber: 1,
  revisionKind: 'ORIGINAL',
  state: 'SUPERSEDED',
  grossAmount: 1810,
  returnedAmount: 0,
  activeAmount: 1810,
  issuedAt: new Date('2026-08-19T00:00:00+07:00'),
  supersededAt: new Date('2026-08-21T00:00:00+07:00'),
  consolidatedAt: null,
  cancelledAt: null,
  replacesDocumentId: null,
  replacesDocument: null,
  successorDocument: {
    id: 2,
    documentNumber: 'DN-ADJ-022608-0001',
    revisionNumber: 2,
    state: 'CURRENT',
  },
});
assert.equal(revision1.historicalReadable, true);
assert.equal(revision1.currentAuthority, false);
assert.equal(revision1.successor.revisionNumber, 2);

const revision2 = mapRevisionSummary({
  id: 2,
  branchId: 2,
  saleId: 1046,
  documentNumber: 'DN-ADJ-022608-0001',
  revisionNumber: 2,
  revisionKind: 'RETURN_ADJUSTMENT',
  state: 'CURRENT',
  grossAmount: 1810,
  returnedAmount: 640,
  activeAmount: 1170,
  issuedAt: new Date('2026-08-21T00:00:00+07:00'),
  supersededAt: null,
  consolidatedAt: null,
  cancelledAt: null,
  replacesDocumentId: 1,
  replacesDocument: {
    id: 1,
    documentNumber: 'DN-SL-022608-0077',
    revisionNumber: 1,
    state: 'SUPERSEDED',
  },
  successorDocument: null,
});
assert.equal(revision2.currentAuthority, true);
assert.equal(revision2.returnedAmount, 640);
assert.equal(revision2.activeAmount, 1170);
assert.equal(revision2.predecessor.revisionNumber, 1);

assert.match(routes, /:\id\/delivery-note\/revisions/);
assert.match(routes, /:\id\/delivery-note\/revisions\/:revisionId/);
assert.match(controller, /listDeliveryNoteRevisionHistory/);
assert.match(controller, /getDeliveryNoteRevisionById/);
assert.match(service, /historicalReadable:\s*true/);
assert.match(service, /currentAuthority:\s*row\.state === 'CURRENT'/);
assert.match(service, /lines:\s*Object\.freeze/);
assert.match(service, /returnSources:\s*Object\.freeze/);
assert.doesNotMatch(service, /create\(|update\(|delete\(|stockMovement|payment|receivable/);

console.log('Delivery Note lifecycle Wave 2D historical lineage read contract: PASS');
