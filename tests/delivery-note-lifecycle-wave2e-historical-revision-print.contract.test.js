'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { composeHistoricalRevisionPrintProjection } = require('../src/modules/sales/documents/print/projectHistoricalSaleDeliveryNoteRevisionService');
const root = path.resolve(__dirname, '..');
const baseProjector = fs.readFileSync(path.join(root, 'src/modules/sales/documents/print/projectSaleDeliveryNoteService.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'src/modules/sales/routes/saleRoutes.js'), 'utf8');
const legacyProjection = {
  document: { type: 'DELIVERY_NOTE', saleId: 1046, saleCode: 'SL-022608-0077', documentNumber: 'DN-SL-022608-0077', totalAmount: 1810, replacement: { replacementId: 999 } },
  issuer: { id: 2, name: 'Branch 2' },
  recipient: { name: 'Customer' },
  lines: [{ id: 1, lineAmount: 1810 }],
  replacementProjection: { replacementId: 999 },
};
const revision1 = {
  id: 501, documentNumber: 'DN-SL-022608-0077', revisionNumber: 1, revisionKind: 'ORIGINAL', state: 'SUPERSEDED', currentAuthority: false,
  grossAmount: 1810, returnedAmount: 0, activeAmount: 1810, issuedAt: new Date('2026-08-19T00:00:00+07:00'), predecessor: null,
  successor: { id: 502, documentNumber: 'DN-SL-022608-0077-R2', revisionNumber: 2, state: 'CURRENT' }, returnSources: [],
  lines: [{ sourceLineType: 'STOCK', sourceLineId: 1, quantity: 1, lineAmount: 1170 }, { sourceLineType: 'SIMPLE', sourceLineId: 2, quantity: 2, lineAmount: 640 }],
};
const original = composeHistoricalRevisionPrintProjection({ revision: revision1, legacyProjection });
assert.equal(original.document.totalAmount, 1810);
assert.equal(original.document.lifecycleState, 'SUPERSEDED');
assert.equal(original.document.currentAuthority, false);
assert.equal(original.document.historicalPrint, true);
assert.equal(original.lines.length, 2);
assert.equal(original.document.replacement, null);
assert.equal(original.replacementProjection, null);
assert.equal(original.document.lifecycleActions.canCreateAdjustedRevision, false);
assert.equal(original.document.lifecycleActions.canConsolidate, false);
assert.equal(original.document.lifecycleActions.canInvoice, false);
assert.equal(original.document.lifecycleActions.canPrintHistorical, true);
assert.equal(original.deliveryNoteReadAuthority.source, 'PERSISTED_HISTORICAL_REVISION');
const revision2 = {
  ...revision1, id: 502, documentNumber: 'DN-SL-022608-0077-R2', revisionNumber: 2, revisionKind: 'RETURN_ADJUSTMENT', state: 'CURRENT', currentAuthority: true,
  returnedAmount: 640, activeAmount: 1170, predecessor: { id: 501, documentNumber: 'DN-SL-022608-0077', revisionNumber: 1, state: 'SUPERSEDED' }, successor: null,
  returnSources: [{ saleReturnId: 77, returnedAt: new Date('2026-08-21T05:02:40Z') }], lines: [{ sourceLineType: 'STOCK', sourceLineId: 1, quantity: 1, lineAmount: 1170 }],
};
const adjusted = composeHistoricalRevisionPrintProjection({ revision: revision2, legacyProjection });
assert.equal(adjusted.document.totalAmount, 1170);
assert.equal(adjusted.document.grossAmount, 1810);
assert.equal(adjusted.document.returnedAmount, 640);
assert.equal(adjusted.lines.length, 1);
assert.equal(adjusted.document.documentNumber, 'DN-SL-022608-0077-R2');
assert.match(baseProjector, /historicalRead\s*=\s*false/);
assert.match(baseProjector, /consolidatedSource\s*&&\s*historicalRead\s*!==\s*true/);
assert.match(routes, /delivery-note\/revisions\/:revisionId\/print/);
console.log('Delivery Note lifecycle Wave 2E historical revision print contract: PASS');
